import type { DataCivil } from '../../platform/domain/relogio';
import type {
  Divisao,
  Nivel,
  OrigemDaFicha,
  SituacaoGuardada,
  TreinoDaFicha,
} from '../domain/ficha';

export interface DadosDoExercicio {
  nome: string;
  grupoMuscular: string;
  equipamento: string;
  videoUrl: string | null;
  instrucoes: string | null;
}

export interface Exercicio extends DadosDoExercicio {
  id: string;
}

export interface DadosDoModelo {
  nome: string;
  divisao: Divisao;
  diasPorSemana: number;
  treinos: TreinoDaFicha[];
}

export interface Modelo extends DadosDoModelo {
  id: string;
}

/** Campos editáveis da ficha: o que a tela salva. */
export interface DadosDaFicha {
  nome: string;
  objetivo: string;
  nivel: Nivel;
  frequenciaSemanal: number;
  divisao: Divisao;
  validaAte: DataCivil | null;
  restricoes: string | null;
  professorId: string | null;
  treinos: TreinoDaFicha[];
}

export interface Ficha extends DadosDaFicha {
  id: string;
  alunoId: string;
  situacao: SituacaoGuardada;
  origem: OrigemDaFicha;
  aprovadaPorId: string | null;
  aprovadaEm: Date | null;
  atualizadaEm: Date;
}

/** A ficha sem as restrições (dado de saúde): listas e painéis não as revelam. */
export type FichaResumida = Omit<Ficha, 'restricoes'>;

export interface NovaFicha extends DadosDaFicha {
  alunoId: string;
  situacao: SituacaoGuardada;
  origem: OrigemDaFicha;
  aprovadaPorId?: string | null;
  aprovadaEm?: Date | null;
  atualizadaEm: Date;
}

export interface CamposDeAtualizacaoDaFicha extends Partial<DadosDaFicha> {
  situacao?: SituacaoGuardada;
  origem?: OrigemDaFicha;
  aprovadaPorId?: string | null;
  aprovadaEm?: Date | null;
  atualizadaEm: Date;
}

export interface PaginaDeFichas {
  itens: FichaResumida[];
  total: number;
}

export interface ExecucaoDeTreino {
  id: string;
  alunoId: string;
  fichaId: string | null;
  exercicio: string;
  /** Nulo é peso do corpo. */
  cargaKg: number | null;
  esforco: number;
  realizadoEm: Date;
}

export type NovaExecucao = Omit<ExecucaoDeTreino, 'id'>;

export abstract class RepositorioDeExercicios {
  abstract listar(grupoMuscular?: string): Promise<Exercicio[]>;
  abstract porId(id: string): Promise<Exercicio | null>;
  abstract porNome(nome: string): Promise<Exercicio | null>;
  abstract criar(dados: DadosDoExercicio): Promise<Exercicio>;
  abstract atualizar(id: string, dados: DadosDoExercicio): Promise<Exercicio>;
}

export abstract class RepositorioDeModelos {
  abstract listar(): Promise<Modelo[]>;
  abstract porId(id: string): Promise<Modelo | null>;
  abstract porNome(nome: string): Promise<Modelo | null>;
  abstract criar(dados: DadosDoModelo): Promise<Modelo>;
  abstract atualizar(id: string, dados: DadosDoModelo): Promise<Modelo>;
}

/** Persistência das fichas, no cliente transacional do tenant (RLS). */
export abstract class RepositorioDeFichas {
  /** Revela as restrições; a leitura vai para o log de acesso em nome de `quem`. */
  abstract porId(id: string, quem: string): Promise<Ficha | null>;
  /** Resumida: sem revelar as restrições (o aluno e a lista não precisam delas). */
  abstract resumoPorId(id: string): Promise<FichaResumida | null>;
  /** A ficha em andamento do aluno: rascunho, aguardando aprovação ou ativa (a mais recente). */
  abstract atualDoAluno(alunoId: string, quem: string): Promise<Ficha | null>;
  /** A que o aluno vê no app: ativa e dentro da validade. */
  abstract ativaDoAluno(alunoId: string, hoje: DataCivil): Promise<FichaResumida | null>;
  /** Todas as fichas ativas, aguardando aprovação ou rascunho, da validade mais próxima. */
  abstract listar(pagina: number, limite: number): Promise<PaginaDeFichas>;
  abstract aguardandoAprovacao(): Promise<FichaResumida[]>;
  /** Ativas com validade até `ate`, inclusive (inclui as já vencidas). */
  abstract ativasComValidadeAte(ate: DataCivil): Promise<FichaResumida[]>;
  abstract contarAtivas(hoje: DataCivil): Promise<number>;
  /** Alunos que têm ficha em andamento (qualquer situação, menos recusada). */
  abstract alunosComFicha(): Promise<string[]>;
  abstract criar(dados: NovaFicha): Promise<Ficha>;
  abstract atualizar(id: string, campos: CamposDeAtualizacaoDaFicha): Promise<Ficha>;
  /** Exclusão do titular (LGPD): apaga as fichas do aluno e devolve quantas. */
  abstract excluirDoAluno(alunoId: string): Promise<number>;
  abstract doAluno(alunoId: string, quem: string): Promise<Ficha[]>;
}

export abstract class RepositorioDeExecucoes {
  abstract registrar(dados: NovaExecucao): Promise<ExecucaoDeTreino>;
  /** Do mais antigo ao mais recente. */
  abstract doAluno(alunoId: string): Promise<ExecucaoDeTreino[]>;
  abstract excluirDoAluno(alunoId: string): Promise<number>;
}
