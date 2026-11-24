import type {
  MetodoDoDispositivo,
  StatusDoComando,
  TipoDeBiometria,
  TipoDeComando,
  TipoDeDispositivo,
} from '../domain/dispositivo';

// Portas do domínio dispositivos. Os repositórios usam o cliente da transação do tenant (RLS).

export interface AgenteDaCatraca {
  id: string;
  nome: string;
  credencialHash: string;
  credencialGeradaEm: Date;
  versaoDoAgente: string | null;
  ultimoBatimentoEm: Date | null;
  ultimaSincronizacaoEm: Date | null;
  revogadoEm: Date | null;
  criadoEm: Date;
}

export abstract class RepositorioDeAgentes {
  abstract criar(
    id: string,
    dados: { nome: string; credencialHash: string; versaoDoAgente: string | null },
    agora: Date,
  ): Promise<AgenteDaCatraca>;
  abstract porId(id: string): Promise<AgenteDaCatraca | null>;
  abstract listar(): Promise<AgenteDaCatraca[]>;
  abstract trocarCredencial(id: string, credencialHash: string, agora: Date): Promise<void>;
  abstract revogar(id: string, agora: Date): Promise<void>;
  abstract registrarBatimento(
    id: string,
    versaoDoAgente: string | null,
    agora: Date,
  ): Promise<void>;
  abstract registrarSincronizacao(id: string, agora: Date): Promise<void>;
}

export interface CodigoDePareamento {
  id: string;
  codigo: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export abstract class RepositorioDeCodigos {
  /**
   * Apaga os códigos vencidos e os ainda não usados antes de criar o novo: só o último vale. `null`
   * quando o código sorteado já existe no tenant (o chamador sorteia outro).
   */
  abstract criar(
    codigo: string,
    expiraEm: Date,
    criadoPor: string | null,
    agora: Date,
  ): Promise<CodigoDePareamento | null>;
  /**
   * Consome o código de forma atômica (UPDATE ... WHERE usado_em IS NULL AND expira_em >= agora):
   * devolve `false` se não existe, venceu ou já foi usado. Vale uma troca só.
   */
  abstract consumir(codigo: string, agenteId: string, agora: Date): Promise<boolean>;
}

export interface Dispositivo {
  id: string;
  nome: string;
  tipo: TipoDeDispositivo;
  local: string;
  metodos: MetodoDoDispositivo[];
  unidadeId: string | null;
  agenteId: string | null;
  online: boolean;
  ultimoBatimentoEm: Date | null;
  criadoEm: Date;
}

export interface NovoDispositivo {
  nome: string;
  tipo: TipoDeDispositivo;
  local: string;
  metodos: MetodoDoDispositivo[];
  unidadeId: string | null;
  agenteId: string | null;
}

export abstract class RepositorioDeDispositivos {
  abstract criar(novo: NovoDispositivo): Promise<Dispositivo>;
  abstract atualizar(id: string, dados: NovoDispositivo): Promise<Dispositivo | null>;
  abstract excluir(id: string): Promise<boolean>;
  abstract porId(id: string): Promise<Dispositivo | null>;
  abstract listar(): Promise<Dispositivo[]>;
  abstract doAgente(agenteId: string): Promise<Dispositivo[]>;
  /** Dispositivos do agente ou ainda sem agente, entre os ids informados. */
  abstract doAgenteOuLivres(agenteId: string, ids: readonly string[]): Promise<Dispositivo[]>;
  abstract marcarOnline(id: string, agenteId: string, agora: Date): Promise<void>;
  abstract marcarOffline(id: string): Promise<void>;
  /** Online sem sinal desde antes do limite. */
  abstract onlineSemSinalDesde(limite: Date): Promise<Dispositivo[]>;
}

export interface QuedaDeDispositivo {
  id: string;
  dispositivoId: string;
  desde: Date;
  voltouEm: Date | null;
}

export abstract class RepositorioDeQuedas {
  abstract abrir(dispositivoId: string, desde: Date): Promise<QuedaDeDispositivo>;
  /** Fecha a queda aberta do dispositivo; `null` se não havia. */
  abstract fechar(dispositivoId: string, voltouEm: Date): Promise<QuedaDeDispositivo | null>;
  abstract aberta(dispositivoId: string): Promise<QuedaDeDispositivo | null>;
  /** Quedas abertas e as que fecharam depois de `desde`, as mais recentes primeiro. */
  abstract recentes(desde: Date, limite: number): Promise<QuedaDeDispositivo[]>;
  abstract doDispositivo(dispositivoId: string, limite: number): Promise<QuedaDeDispositivo[]>;
  abstract excluirDoDispositivo(dispositivoId: string): Promise<void>;
}

export interface ComandoDoAgente {
  id: string;
  agenteId: string;
  dispositivoId: string | null;
  tipo: TipoDeComando;
  dados: Record<string, unknown>;
  status: StatusDoComando;
  criadoEm: Date;
  expiraEm: Date;
  respondidoEm: Date | null;
  resposta: Record<string, unknown> | null;
}

export interface NovoComando {
  agenteId: string;
  dispositivoId: string | null;
  tipo: TipoDeComando;
  dados: Record<string, unknown>;
  expiraEm: Date;
}

export abstract class RepositorioDeComandos {
  abstract criar(novo: NovoComando): Promise<ComandoDoAgente>;
  abstract porId(id: string): Promise<ComandoDoAgente | null>;
  /** Pendentes e ainda válidos do agente; passam a `entregue`. */
  abstract entregarPendentes(agenteId: string, agora: Date): Promise<ComandoDoAgente[]>;
  abstract responder(
    id: string,
    agenteId: string,
    status: 'concluido' | 'falhou',
    resposta: Record<string, unknown> | null,
    agora: Date,
  ): Promise<ComandoDoAgente | null>;
  /** Marca como expirados os comandos sem resposta até `agora`. */
  abstract expirar(agora: Date): Promise<number>;
}

export interface CadastroBiometrico {
  id: string;
  alunoId: string;
  tipo: TipoDeBiometria;
  dispositivoId: string | null;
  referencia: string | null;
  status: 'pendente' | 'cadastrado' | 'falhou';
  comandoId: string | null;
  atualizadoEm: Date;
}

export abstract class RepositorioDeCadastrosBiometricos {
  abstract salvar(dados: Omit<CadastroBiometrico, 'id'>): Promise<CadastroBiometrico>;
  abstract porComando(comandoId: string): Promise<CadastroBiometrico | null>;
  abstract doAluno(alunoId: string): Promise<CadastroBiometrico[]>;
  abstract atualizarStatus(
    id: string,
    status: CadastroBiometrico['status'],
    referencia: string | null,
    agora: Date,
  ): Promise<void>;
  abstract excluirDoAluno(alunoId: string): Promise<number>;
}

export interface AlteracaoDoCache {
  chave: string;
  alunoId: string | null;
  versao: number;
}

export abstract class RepositorioDoCacheDeAcesso {
  /** Dá uma versão nova (sequência do banco) ao aluno, ou às regras com `alunoId` nulo. */
  abstract alterar(alunoId: string | null, agora: Date): Promise<void>;
  /** Garante uma linha para cada aluno informado (primeira carga completa). */
  abstract semear(alunoIds: readonly string[], agora: Date): Promise<void>;
  abstract versaoAtual(): Promise<number>;
  /** Alterações com versão maior que `desde`, da menor para a maior. */
  abstract desde(desde: number, limite: number): Promise<AlteracaoDoCache[]>;
}
