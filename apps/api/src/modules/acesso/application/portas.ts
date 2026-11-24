import type {
  ConfiguracaoDeAcesso,
  DirecaoDeAcesso,
  MetodoDeAcesso,
  MotivoDeNegacao,
  PassagemLiberada,
  ResultadoDeAcesso,
  SituacaoDoContratoParaAcesso,
} from '@gymos/shared-acesso';
import type { DataCivil } from '../../platform/domain/relogio';
import type {
  AlertaApurado,
  ConfiguracaoDeAlertas,
  FrequenciaDoAluno,
  NivelDoAlerta,
  TipoDeAlerta,
} from '../domain/alerta';

// Portas do domínio acesso. Os repositórios usam o cliente da transação do tenant (RLS).

export interface Acesso {
  id: string;
  idDeOrigem: string;
  unidadeId: string;
  alunoId: string | null;
  metodo: MetodoDeAcesso;
  direcao: DirecaoDeAcesso;
  resultado: ResultadoDeAcesso;
  motivo: MotivoDeNegacao | null;
  modalidade: string | null;
  dispositivoId: string | null;
  registradoEm: Date;
  registradoPor: string | null;
  observacao: string | null;
}

export type NovoAcesso = Omit<Acesso, 'id'>;

export interface EntradaPorDia {
  alunoId: string;
  dia: DataCivil;
}

export abstract class RepositorioDeAcessos {
  /** `null` quando o `idDeOrigem` já existe (reenvio): o acesso é gravado uma vez só. */
  abstract criar(acesso: NovoAcesso): Promise<Acesso | null>;
  abstract porIdDeOrigem(idDeOrigem: string): Promise<Acesso | null>;
  /**
   * Passagens liberadas do aluno desde o dia (inclusive) e antes do instante, de qualquer ordem:
   * o que as regras de limite e de anti-passback precisam.
   */
  abstract passagensLiberadas(
    alunoId: string,
    desde: DataCivil,
    antes: Date,
  ): Promise<PassagemLiberada[]>;
  /** Instantes das entradas liberadas no intervalo de dias (inclusive), para a frequência por horário. */
  abstract entradasNoPeriodo(de: DataCivil, ate: DataCivil): Promise<Date[]>;
  /** Um registro por aluno e dia com entrada liberada no intervalo (inclusive). */
  abstract diasComEntrada(de: DataCivil, ate: DataCivil): Promise<EntradaPorDia[]>;
  /** Último dia com entrada liberada de cada aluno (de todos os tempos). */
  abstract ultimoDiaComEntrada(): Promise<Map<string, DataCivil>>;
  abstract contarDoDia(dia: DataCivil): Promise<{ liberados: number; negados: number }>;
  /** Exclusão do titular (LGPD): apaga os acessos do aluno. */
  abstract excluirDoAluno(alunoId: string): Promise<number>;
  abstract doAluno(alunoId: string): Promise<Acesso[]>;
}

export abstract class RepositorioDeConfiguracaoDeAcesso {
  /** Cria a linha com os padrões na primeira leitura. */
  abstract obter(): Promise<ConfiguracaoDeAcesso>;
  abstract salvar(config: ConfiguracaoDeAcesso): Promise<void>;
}

export abstract class RepositorioDeConfiguracaoDeAlertas {
  abstract obter(): Promise<ConfiguracaoDeAlertas>;
  abstract salvar(config: ConfiguracaoDeAlertas): Promise<void>;
  /** Trava diária: `true` só para quem chega primeiro no dia; marca o dia como verificado. */
  abstract reivindicarVerificacao(hoje: DataCivil): Promise<boolean>;
}

export interface ChaveDeQr {
  id: string;
  chavePublica: string;
  ativa: boolean;
}

export abstract class RepositorioDeChavesDeQr {
  /** A chave ativa com a privada revelada (só o servidor a lê); `null` se ainda não existe. */
  abstract ativaComPrivada(): Promise<(ChaveDeQr & { chavePrivada: string }) | null>;
  abstract criar(par: { chavePublica: string; chavePrivada: string }): Promise<ChaveDeQr>;
  /** Chaves que ainda conferem QR (ativa e as rotacionadas não revogadas). */
  abstract validas(): Promise<ChaveDeQr[]>;
}

export abstract class RegistroDeQrUsado {
  /**
   * Consome o nonce de forma atômica (INSERT com unicidade por tenant): `true` na primeira vez,
   * `false` se já foi usado. É o uso único do token.
   */
  abstract consumir(nonce: string, alunoId: string, usadoEm: Date): Promise<boolean>;
  /** Esquece o que passou da validade do QR por uma folga larga (o token vencido já é recusado). */
  abstract limparAntesDe(limite: Date): Promise<number>;
  abstract excluirDoAluno(alunoId: string): Promise<number>;
}

export interface AlertaDeFrequencia {
  id: string;
  alunoId: string;
  tipo: TipoDeAlerta;
  nivel: NivelDoAlerta;
  diasSemTreinar: number | null;
  quedaPercentual: number | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export abstract class RepositorioDeAlertas {
  abstract abertos(): Promise<AlertaDeFrequencia[]>;
  abstract abrir(alunoId: string, alerta: AlertaApurado, quando: Date): Promise<AlertaDeFrequencia>;
  abstract atualizar(id: string, alerta: AlertaApurado, quando: Date): Promise<void>;
  abstract resolver(id: string, quando: Date): Promise<void>;
  abstract excluirDoAluno(alunoId: string): Promise<number>;
  abstract doAluno(alunoId: string): Promise<AlertaDeFrequencia[]>;
}

/** O que a catraca precisa saber do aluno, vindo dos domínios de alunos e cobrança (T15a e T19). */
export interface ContextoDoAluno {
  alunoId: string;
  nome: string;
  contrato: SituacaoDoContratoParaAcesso;
  /** De `diasDeAtraso` da Cobrança (ADR-018). */
  diasDeAtraso: number;
  planoNome: string | null;
  modalidadesDoPlano: readonly string[];
  acessosPorSemana: number | null;
  /** Início do contrato vigente: ponto de partida de quem nunca treinou. */
  inicioDoContrato: DataCivil | null;
}

export abstract class AlunosParaAcesso {
  /** `null` quando o aluno não existe. */
  abstract contexto(alunoId: string): Promise<ContextoDoAluno | null>;
  abstract todosOsIds(): Promise<string[]>;
  abstract resumos(
    ids: readonly string[],
  ): Promise<Map<string, { nome: string; professorId: string | null }>>;
  abstract unidadePadrao(): Promise<string>;
}

export type { FrequenciaDoAluno };

/** A academia (tenant) do contexto: o QR só vale na academia que o emitiu. */
export abstract class AcademiaAtual {
  abstract id(): string;
}
