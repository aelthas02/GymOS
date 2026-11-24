import { Injectable } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import type { Tenant } from '../../platform/domain/tenant';
import {
  DURACAO_DO_CONVITE_MS,
  emMs,
  normalizarEmail,
  usoUnicoDisponivel,
} from '../domain/credenciais';
import {
  CifraDeSenha,
  EnderecosDosApps,
  EnvioDeEmail,
  GeradorDeSegredos,
  RepositorioDeConvites,
  RepositorioDeTiposDeAcesso,
  RepositorioDeUsuarios,
  type Usuario,
} from './portas';
import { type SessaoAberta, Sessoes } from './sessoes';

/** Usuário criado pelo cadastro do Funcionário (T26a) que ainda não aceitou o convite. */
const usuarioPendente = (usuario: Usuario): boolean => usuario.senhaHash === null && usuario.ativo;

export type ResultadoDoConvite =
  | { tipo: 'ok'; id: string; expiraEm: Date; link: string }
  | { tipo: 'tipo-inexistente' }
  | { tipo: 'email-em-uso' };

/** Convite da equipe por e-mail; o link leva um token de uso único (T12, Equipe). */
@Injectable()
export class ConvidarParaEquipe {
  constructor(
    private readonly convites: RepositorioDeConvites,
    private readonly tipos: RepositorioDeTiposDeAcesso,
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly segredos: GeradorDeSegredos,
    private readonly enderecos: EnderecosDosApps,
    private readonly email: EnvioDeEmail,
    private readonly relogio: Relogio,
  ) {}

  async executar(
    tenant: Tenant,
    dados: { email: string; nome: string | null; tipoDeAcessoId: string },
  ): Promise<ResultadoDoConvite> {
    const email = normalizarEmail(dados.email);
    if (!(await this.tipos.porId(dados.tipoDeAcessoId))) {
      return { tipo: 'tipo-inexistente' };
    }
    const existente = await this.usuarios.porEmail(email);
    if (existente && !usuarioPendente(existente)) {
      return { tipo: 'email-em-uso' };
    }
    const token = this.segredos.token();
    const convite = await this.convites.criar({
      email,
      nome: dados.nome,
      tipoDeAcessoId: dados.tipoDeAcessoId,
      tokenHash: this.segredos.hash(token),
      expiraEm: emMs(this.relogio.agora(), DURACAO_DO_CONVITE_MS),
    });
    const link = `${this.enderecos.painel(tenant.slug)}/convite?token=${token}`;
    await this.email.enviar({
      para: email,
      assunto: `Convite para a equipe da ${tenant.nome}`,
      texto:
        `Olá${dados.nome ? `, ${dados.nome}` : ''}! Você recebeu um convite para entrar na ` +
        `equipe da ${tenant.nome} no GymOS. Crie a sua senha em ${link} (o link vale por 7 dias).`,
      finalidade: 'transacional',
    });
    return { tipo: 'ok', id: convite.id, expiraEm: convite.expiraEm, link };
  }
}

export type ResultadoDoAceite =
  | { tipo: 'ok'; sessao: SessaoAberta }
  | { tipo: 'inexistente' }
  | { tipo: 'indisponivel' }
  | { tipo: 'email-em-uso' };

/** Aceite do convite: cria o usuário com a senha escolhida e já abre a sessão. */
@Injectable()
export class AceitarConvite {
  constructor(
    private readonly convites: RepositorioDeConvites,
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly segredos: GeradorDeSegredos,
    private readonly cifra: CifraDeSenha,
    private readonly sessoes: Sessoes,
    private readonly relogio: Relogio,
  ) {}

  async executar(
    tenantId: string,
    dados: { token: string; nome: string; senha: string },
  ): Promise<ResultadoDoAceite> {
    const agora = this.relogio.agora();
    const convite = await this.convites.porTokenHash(this.segredos.hash(dados.token));
    if (!convite) {
      return { tipo: 'inexistente' };
    }
    if (!usoUnicoDisponivel(convite, agora)) {
      return { tipo: 'indisponivel' };
    }
    const existente = await this.usuarios.porEmail(convite.email);
    if (existente && !usuarioPendente(existente)) {
      return { tipo: 'email-em-uso' };
    }
    await this.convites.marcarUsado(convite.id, agora);
    const senhaHash = await this.cifra.cifrar(dados.senha);
    let usuarioId: string;
    if (existente) {
      // O cadastro do Funcionário já criou o usuário, com o tipo de acesso atual dele: só falta a senha.
      await this.usuarios.definirSenha(existente.id, senhaHash);
      usuarioId = existente.id;
    } else {
      usuarioId = (
        await this.usuarios.criar({
          nome: dados.nome.trim(),
          email: convite.email,
          senhaHash,
          tipoDeAcessoId: convite.tipoDeAcessoId,
        })
      ).id;
    }
    return { tipo: 'ok', sessao: await this.sessoes.abrir('staff', usuarioId, tenantId) };
  }
}
