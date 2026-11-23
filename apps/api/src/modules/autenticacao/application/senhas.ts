import { Injectable } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import type { Tenant } from '../../platform/domain/tenant';
import {
  DURACAO_DA_REDEFINICAO_MS,
  DURACAO_DO_CODIGO_DE_PRIMEIRO_ACESSO_MS,
  emMs,
  interpretarIdentificador,
  normalizarEmail,
  type Publico,
  usoUnicoDisponivel,
} from '../domain/credenciais';
import { CredencialPeloIdentificador } from './entrada';
import {
  CifraDeSenha,
  EnderecosDosApps,
  EnvioDeEmail,
  GeradorDeSegredos,
  RepositorioDeCredenciaisDeAluno,
  RepositorioDeRedefinicoes,
  RepositorioDeRefresh,
  RepositorioDeUsuarios,
} from './portas';

/**
 * "Esqueci minha senha": se a conta existir e tiver e-mail, manda o link de redefinição. A resposta
 * é a mesma nos dois casos, para não revelar quem tem conta.
 */
@Injectable()
export class SolicitarRedefinicaoDeSenha {
  constructor(
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly credencial: CredencialPeloIdentificador,
    private readonly redefinicoes: RepositorioDeRedefinicoes,
    private readonly segredos: GeradorDeSegredos,
    private readonly enderecos: EnderecosDosApps,
    private readonly email: EnvioDeEmail,
    private readonly relogio: Relogio,
  ) {}

  async executar(tenant: Tenant, publico: Publico, identificador: string): Promise<void> {
    const destino = await this.destino(publico, identificador);
    if (!destino) {
      return;
    }
    const token = this.segredos.token();
    await this.redefinicoes.criar({
      publico,
      sujeitoId: destino.sujeitoId,
      tokenHash: this.segredos.hash(token),
      expiraEm: emMs(this.relogio.agora(), DURACAO_DA_REDEFINICAO_MS),
    });
    const base =
      publico === 'staff' ? this.enderecos.painel(tenant.slug) : this.enderecos.app(tenant.slug);
    const link = `${base}/redefinir-senha?token=${token}`;
    await this.email.enviar({
      para: destino.email,
      assunto: `Redefinição de senha · ${tenant.nome}`,
      texto:
        `Recebemos um pedido para redefinir a sua senha na ${tenant.nome}. Crie uma nova em ` +
        `${link} (o link vale por 1 hora). Se não foi você, ignore este e-mail.`,
      finalidade: 'transacional',
    });
  }

  private async destino(
    publico: Publico,
    identificador: string,
  ): Promise<{ sujeitoId: string; email: string } | null> {
    if (publico === 'staff') {
      const usuario = await this.usuarios.porEmail(normalizarEmail(identificador));
      return usuario?.ativo ? { sujeitoId: usuario.id, email: usuario.email } : null;
    }
    const interpretado = interpretarIdentificador(identificador);
    const credencial = interpretado ? await this.credencial.buscar(interpretado) : null;
    return credencial?.email ? { sujeitoId: credencial.alunoId, email: credencial.email } : null;
  }
}

/** Troca a senha pelo link de redefinição e encerra todas as sessões da conta. */
@Injectable()
export class RedefinirSenha {
  constructor(
    private readonly redefinicoes: RepositorioDeRedefinicoes,
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly credenciais: RepositorioDeCredenciaisDeAluno,
    private readonly refresh: RepositorioDeRefresh,
    private readonly segredos: GeradorDeSegredos,
    private readonly cifra: CifraDeSenha,
    private readonly relogio: Relogio,
  ) {}

  async executar(
    publico: Publico,
    dados: { token: string; senha: string },
  ): Promise<'ok' | 'indisponivel'> {
    const agora = this.relogio.agora();
    const pedido = await this.redefinicoes.porTokenHash(this.segredos.hash(dados.token));
    if (pedido?.publico !== publico || !usoUnicoDisponivel(pedido, agora)) {
      return 'indisponivel';
    }
    const senhaHash = await this.cifra.cifrar(dados.senha);
    await this.redefinicoes.marcarUsada(pedido.id, agora);
    if (publico === 'staff') {
      await this.usuarios.definirSenha(pedido.sujeitoId, senhaHash);
    } else {
      await this.credenciais.salvar({ alunoId: pedido.sujeitoId, senhaHash });
    }
    await this.refresh.revogarDoSujeito(publico, pedido.sujeitoId, agora);
    return 'ok';
  }
}

/**
 * Código de primeiro acesso do aluno, entregue pela recepção (o T15a chama ao cadastrar). Gera um
 * novo a cada chamada; o anterior deixa de valer.
 */
@Injectable()
export class GerarCodigoDePrimeiroAcesso {
  constructor(
    private readonly credenciais: RepositorioDeCredenciaisDeAluno,
    private readonly segredos: GeradorDeSegredos,
    private readonly relogio: Relogio,
  ) {}

  async executar(alunoId: string, email: string | null): Promise<string> {
    const codigo = this.segredos.codigo();
    await this.credenciais.salvar({
      alunoId,
      ...(email === null ? {} : { email: normalizarEmail(email) }),
      codigoHash: this.segredos.hash(codigo),
      codigoExpiraEm: emMs(this.relogio.agora(), DURACAO_DO_CODIGO_DE_PRIMEIRO_ACESSO_MS),
    });
    return codigo;
  }
}
