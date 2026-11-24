import { Injectable } from '@nestjs/common';
import { Relogio } from '../../platform/domain/relogio';
import {
  chaveDoIdentificador,
  type IdentificadorDoAluno,
  interpretarIdentificador,
  LIMITE_DE_TENTATIVAS,
  normalizarEmail,
  usoUnicoDisponivel,
} from '../domain/credenciais';
import { podeEntrarNoPainel } from '../domain/tipos-de-acesso';
import {
  CifraDeSenha,
  type Contador,
  type CredencialDoAluno,
  GeradorDeSegredos,
  LimiteDeTentativas,
  LocalizadorDeAlunoPorCpf,
  RepositorioDeCredenciaisDeAluno,
  RepositorioDeUsuarios,
} from './portas';
import { type SessaoAberta, Sessoes } from './sessoes';

export type ResultadoDaEntrada =
  { tipo: 'ok'; sessao: SessaoAberta } | { tipo: 'invalido' } | { tipo: 'bloqueado' };

export interface Tentativa {
  tenantId: string;
  ip: string;
}

/** Contadores de tentativas erradas da conta e do IP, com o tenant na chave. */
function contadores(tentativa: Tentativa, conta: string): [Contador, Contador] {
  const { janelaMs, porConta, porIp } = LIMITE_DE_TENTATIVAS;
  return [
    { chave: `${tentativa.tenantId}:conta:${conta}`, limite: porConta, janelaMs },
    { chave: `${tentativa.tenantId}:ip:${tentativa.ip}`, limite: porIp, janelaMs },
  ];
}

/**
 * Login com limite de tentativas: bloqueado não confere a senha; cada erro conta na conta e no IP; o
 * acerto zera a conta. Sem conta, a senha é conferida contra um hash fictício, no mesmo tempo.
 */
@Injectable()
export class PortaoDeEntrada {
  private hashFicticio?: Promise<string>;

  constructor(
    private readonly limite: LimiteDeTentativas,
    private readonly cifra: CifraDeSenha,
    private readonly relogio: Relogio,
  ) {}

  async tentar<T>(
    tentativa: Tentativa,
    conta: string,
    verificar: () => Promise<T | null>,
  ): Promise<{ tipo: 'ok'; valor: T } | { tipo: 'invalido' } | { tipo: 'bloqueado' }> {
    const [daConta, doIp] = contadores(tentativa, conta);
    if (await this.limite.bloqueado([daConta, doIp], this.relogio.agora())) {
      return { tipo: 'bloqueado' };
    }
    const valor = await verificar();
    if (valor === null) {
      await this.limite.registrarFalha([daConta, doIp], this.relogio.agora());
      return { tipo: 'invalido' };
    }
    await this.limite.limpar(daConta);
    return { tipo: 'ok', valor };
  }

  async conferir(senha: string, hash: string | null | undefined): Promise<boolean> {
    if (hash) {
      return this.cifra.conferir(senha, hash);
    }
    this.hashFicticio ??= this.cifra.cifrar('senha-ficticia-para-igualar-o-tempo');
    await this.cifra.conferir(senha, await this.hashFicticio);
    return false;
  }
}

@Injectable()
export class EntrarComoEquipe {
  constructor(
    private readonly portao: PortaoDeEntrada,
    private readonly usuarios: RepositorioDeUsuarios,
    private readonly sessoes: Sessoes,
  ) {}

  async executar(
    tentativa: Tentativa,
    dados: { email: string; senha: string },
  ): Promise<ResultadoDaEntrada> {
    const email = normalizarEmail(dados.email);
    const resultado = await this.portao.tentar(tentativa, `staff:${email}`, async () => {
      const usuario = await this.usuarios.porEmail(email);
      const confere = await this.portao.conferir(dados.senha, usuario?.senhaHash);
      return usuario && confere && usuario.ativo && podeEntrarNoPainel(usuario.tipoDeAcesso)
        ? usuario
        : null;
    });
    if (resultado.tipo !== 'ok') {
      return resultado;
    }
    return {
      tipo: 'ok',
      sessao: await this.sessoes.abrir('staff', resultado.valor.id, tentativa.tenantId),
    };
  }
}

/** Credencial do aluno pelo CPF (via T15a) ou pelo e-mail. */
@Injectable()
export class CredencialPeloIdentificador {
  constructor(
    private readonly credenciais: RepositorioDeCredenciaisDeAluno,
    private readonly localizador: LocalizadorDeAlunoPorCpf,
  ) {}

  async buscar(identificador: IdentificadorDoAluno): Promise<CredencialDoAluno | null> {
    if (identificador.tipo === 'email') {
      return this.credenciais.porEmail(identificador.email);
    }
    const alunoId = await this.localizador.alunoDoCpf(identificador.cpf);
    return alunoId ? this.credenciais.porAluno(alunoId) : null;
  }
}

@Injectable()
export class EntrarComoAluno {
  constructor(
    private readonly portao: PortaoDeEntrada,
    private readonly credencial: CredencialPeloIdentificador,
    private readonly sessoes: Sessoes,
  ) {}

  async executar(
    tentativa: Tentativa,
    dados: { identificador: string; senha: string },
  ): Promise<ResultadoDaEntrada> {
    const identificador = interpretarIdentificador(dados.identificador);
    if (!identificador) {
      return { tipo: 'invalido' };
    }
    const conta = `aluno:${chaveDoIdentificador(identificador)}`;
    const resultado = await this.portao.tentar(tentativa, conta, async () => {
      const credencial = await this.credencial.buscar(identificador);
      const confere = await this.portao.conferir(dados.senha, credencial?.senhaHash);
      return confere ? credencial : null;
    });
    if (resultado.tipo !== 'ok') {
      return resultado;
    }
    return {
      tipo: 'ok',
      sessao: await this.sessoes.abrir('aluno', resultado.valor.alunoId, tentativa.tenantId),
    };
  }
}

/** Primeiro acesso do aluno: o código entregue pela recepção vale uma vez e cria a senha. */
@Injectable()
export class PrimeiroAcessoDoAluno {
  constructor(
    private readonly portao: PortaoDeEntrada,
    private readonly credencial: CredencialPeloIdentificador,
    private readonly credenciais: RepositorioDeCredenciaisDeAluno,
    private readonly segredos: GeradorDeSegredos,
    private readonly cifra: CifraDeSenha,
    private readonly sessoes: Sessoes,
    private readonly relogio: Relogio,
  ) {}

  async executar(
    tentativa: Tentativa,
    dados: { identificador: string; codigo: string; senha: string },
  ): Promise<ResultadoDaEntrada> {
    const identificador = interpretarIdentificador(dados.identificador);
    if (!identificador) {
      return { tipo: 'invalido' };
    }
    const conta = `aluno:${chaveDoIdentificador(identificador)}`;
    const codigoHash = this.segredos.hash(dados.codigo.trim().toUpperCase());
    const resultado = await this.portao.tentar(tentativa, conta, async () => {
      const credencial = await this.credencial.buscar(identificador);
      const valido =
        credencial?.codigoHash === codigoHash &&
        credencial.codigoExpiraEm !== null &&
        usoUnicoDisponivel(
          { expiraEm: credencial.codigoExpiraEm, usadoEm: null },
          this.relogio.agora(),
        );
      return valido ? credencial : null;
    });
    if (resultado.tipo !== 'ok') {
      return resultado;
    }
    const { alunoId } = resultado.valor;
    await this.credenciais.salvar({
      alunoId,
      senhaHash: await this.cifra.cifrar(dados.senha),
      codigoHash: null,
      codigoExpiraEm: null,
    });
    return { tipo: 'ok', sessao: await this.sessoes.abrir('aluno', alunoId, tentativa.tenantId) };
  }
}
