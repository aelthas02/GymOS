import type { DataCivil } from '../../platform/domain/relogio';
import type {
  ConfiguracaoDeContrato,
  EstadoGuardado,
  SituacaoDeVencimento,
} from '../domain/contrato';
import type { DadosDoPlano, Plano } from '../domain/plano';

// Portas do domínio alunos. Os repositórios rodam no contexto do tenant (RLS) e cuidam da cifra e do
// índice cego (T13c): o caso de uso só vê CPF, telefone e e-mail em claro.

export interface PlanoComAlunos extends Plano {
  /** Alunos com contrato vigente não encerrado neste plano. */
  alunosAtivos: number;
}

export abstract class RepositorioDePlanos {
  abstract listar(busca?: string): Promise<PlanoComAlunos[]>;
  abstract porId(id: string): Promise<Plano | null>;
  /** Pelo nome, sem diferença de maiúsculas (importação); ignora planos excluídos. */
  abstract porNome(nome: string): Promise<Plano | null>;
  abstract criar(dados: DadosDoPlano): Promise<Plano>;
  abstract atualizar(id: string, dados: DadosDoPlano): Promise<Plano>;
  abstract excluir(id: string, quando: Date): Promise<void>;
  abstract alunosAtivos(id: string): Promise<number>;
}

export interface DadosPessoaisDoAluno {
  nome: string;
  /** Só dígitos. */
  cpf: string;
  telefone: string | null;
  email: string | null;
  dataNascimento: DataCivil | null;
  professorId: string | null;
  meta: string | null;
  /** Dado de saúde: cifrado e com log de leitura. */
  restricoes: string | null;
  leadId: string | null;
}

export interface Aluno extends DadosPessoaisDoAluno {
  id: string;
  unidadeId: string;
  criadoEm: Date;
}

export interface FiltroDeAlunos {
  situacao?: SituacaoDeVencimento;
  planoId?: string;
  /** Nome (parte), CPF completo ou telefone completo. */
  busca?: string;
}

export interface ItemDaListaDeAlunos {
  id: string;
  nome: string;
  plano: { id: string; nome: string } | null;
  contrato: EstadoGuardado | null;
}

export interface PaginaDeAlunos {
  itens: ItemDaListaDeAlunos[];
  proximoCursor: string | null;
  contadores: Record<'todos' | SituacaoDeVencimento, number>;
}

export interface ContatoDoAlunoParaMensagem {
  nome: string;
  telefone: string | null;
  email: string | null;
}

export abstract class RepositorioDeAlunos {
  /** Unidade em que o aluno nasce quando o cadastro não informa (a primeira da academia). */
  abstract unidadePadrao(): Promise<string>;
  abstract criar(dados: DadosPessoaisDoAluno & { unidadeId: string }): Promise<Aluno>;
  abstract atualizar(id: string, dados: DadosPessoaisDoAluno): Promise<Aluno>;
  /** Revela os campos cifrados; a leitura das restrições vai para o log de acesso em nome de `quem`. */
  abstract porId(id: string, quem: string): Promise<Aluno | null>;
  abstract nome(id: string): Promise<string | null>;
  /** Nome e professor responsável dos alunos (sem revelar campos cifrados): listas e alertas do T23a. */
  abstract resumos(
    ids: readonly string[],
  ): Promise<Map<string, { nome: string; professorId: string | null }>>;
  /** Ids de todos os alunos da academia (comunicados do T13e). */
  abstract todosOsIds(): Promise<string[]>;
  abstract idPorCpf(cpf: string): Promise<string | null>;
  abstract idPorEmail(email: string): Promise<string | null>;
  /** Pelo índice cego do telefone; aceita o número com ou sem o DDI 55 (resposta do WhatsApp). */
  abstract idPorTelefone(telefone: string): Promise<string | null>;
  /** Nome e contatos revelados (sem dado de saúde): a Mensageria só envia, não guarda o telefone. */
  abstract contato(id: string): Promise<ContatoDoAlunoParaMensagem | null>;
  abstract listar(
    filtro: FiltroDeAlunos,
    paginacao: { limite: number; cursor?: string },
    hoje: DataCivil,
  ): Promise<PaginaDeAlunos>;
  /** Exclusão do titular (LGPD): contratos, credencial do app e o próprio aluno. */
  abstract excluir(id: string): Promise<number>;
}

export interface Contrato extends EstadoGuardado {
  id: string;
  alunoId: string;
  planoId: string;
  planoNome: string;
  valorTotalCentavos: number;
  parcelas: number;
  vigente: boolean;
}

export type CamposDoContrato = Partial<
  Omit<Contrato, 'id' | 'alunoId' | 'planoId' | 'planoNome' | 'parcelas'>
>;

export abstract class RepositorioDeContratos {
  abstract vigenteDoAluno(alunoId: string): Promise<Contrato | null>;
  abstract doAluno(alunoId: string): Promise<Contrato[]>;
  /** Cria o contrato e o torna o vigente do aluno (o anterior deixa de ser). */
  abstract criar(dados: Omit<Contrato, 'id' | 'planoNome' | 'vigente'>): Promise<Contrato>;
  abstract atualizar(id: string, campos: CamposDoContrato): Promise<Contrato>;
  /** Vigentes ainda não encerrados, para a rotina diária. */
  abstract vigentesEmAndamento(): Promise<Contrato[]>;
}

export abstract class RepositorioDeConfiguracao {
  abstract obter(): Promise<ConfiguracaoDeContrato>;
  abstract salvar(config: ConfiguracaoDeContrato): Promise<void>;
}

export interface SituacaoDasParcelas {
  vencimentoEmAtraso: DataCivil | null;
  proximoVencimento: DataCivil | null;
}

/**
 * Parcelas do contrato, do domínio de Cobrança (T19). `null` quando a cobrança ainda não existe: os
 * consumidores usam então o que o evento informa.
 */
export abstract class ParcelasDoContrato {
  abstract situacao(contratoId: string): Promise<SituacaoDasParcelas | null>;
}
