import type { DataCivil } from '../../platform/domain/relogio';
import type {
  Competencia,
  OrigemDaNota,
  RegraDeEmissao,
  SituacaoDaNota,
  TipoDeNota,
} from '../domain/nota-fiscal';

// Portas do domínio fiscal (T20, ADR-008). Os repositórios rodam no contexto do tenant (RLS) e cuidam
// da cifra do CPF do tomador (T13c): o caso de uso só vê o CPF em claro.

export interface NotaFiscal {
  id: string;
  tipo: TipoDeNota;
  situacao: SituacaoDaNota;
  numero: string | null;
  pagamentoId: string | null;
  parcelaId: string | null;
  alunoId: string | null;
  origem: OrigemDaNota | null;
  tomadorNome: string;
  /** Só dígitos; nulo depois da anonimização (LGPD). */
  tomadorCpf: string | null;
  descricao: string;
  codigoDoServico: string;
  competencia: Competencia;
  valorCentavos: number;
  aliquotaIssPontosBase: number;
  issCentavos: number;
  retencoesCentavos: number;
  formaDePagamento: string | null;
  motivoDaRejeicao: string | null;
  motivoDoCancelamento: string | null;
  pdfChave: string | null;
  xmlChave: string | null;
  tentativas: number;
  enviarAoAluno: boolean;
  anexarArquivos: boolean;
  registradaNaFicha: boolean;
  enviadaAoAlunoEm: Date | null;
  emitidaEm: Date | null;
  canceladaEm: Date | null;
  criadoEm: Date;
}

export type NovaNota = { id?: string } & Omit<
  NotaFiscal,
  | 'id'
  | 'situacao'
  | 'numero'
  | 'motivoDaRejeicao'
  | 'motivoDoCancelamento'
  | 'pdfChave'
  | 'xmlChave'
  | 'tentativas'
  | 'enviadaAoAlunoEm'
  | 'emitidaEm'
  | 'canceladaEm'
  | 'criadoEm'
>;

export type CamposDaNota = Partial<
  Pick<
    NotaFiscal,
    | 'situacao'
    | 'numero'
    | 'pagamentoId'
    | 'tomadorNome'
    | 'tomadorCpf'
    | 'descricao'
    | 'valorCentavos'
    | 'issCentavos'
    | 'aliquotaIssPontosBase'
    | 'retencoesCentavos'
    | 'motivoDaRejeicao'
    | 'motivoDoCancelamento'
    | 'pdfChave'
    | 'xmlChave'
    | 'tentativas'
    | 'enviarAoAluno'
    | 'anexarArquivos'
    | 'registradaNaFicha'
    | 'enviadaAoAlunoEm'
    | 'emitidaEm'
    | 'canceladaEm'
  >
>;

export interface FiltroDeNotas {
  competencia?: Competencia;
  situacoes?: readonly SituacaoDaNota[];
  alunoId?: string;
  registradaNaFicha?: boolean;
}

export interface PaginaDeNotas {
  itens: NotaFiscal[];
  proximoCursor: string | null;
}

export interface ResumoDasNotas {
  emitidas: number;
  valorFaturadoCentavos: number;
  pendentes: number;
  rejeitadas: number;
  emitidasPorTipo: Record<TipoDeNota, number>;
}

export abstract class RepositorioDeNotas {
  /** Cria a nota; se já existe uma do mesmo pagamento e tipo, não cria e devolve `null`. */
  abstract criar(nota: NovaNota): Promise<NotaFiscal | null>;
  abstract porId(id: string): Promise<NotaFiscal | null>;
  /** Lê a nota travando a linha (FOR UPDATE) até o fim da transação. */
  abstract travar(id: string): Promise<NotaFiscal | null>;
  abstract doPagamento(pagamentoId: string): Promise<NotaFiscal[]>;
  /** Nota manual de uma parcela ainda sem pagamento (para ligar ao PagamentoConfirmado). */
  abstract daParcelaSemPagamento(parcelaId: string, tipo: TipoDeNota): Promise<NotaFiscal | null>;
  abstract atualizar(id: string, campos: CamposDaNota): Promise<NotaFiscal>;
  /** Mais recentes primeiro, por cursor. */
  abstract listar(
    filtro: FiltroDeNotas,
    paginacao: { limite: number; cursor?: string },
  ): Promise<PaginaDeNotas>;
  abstract resumo(competencia: Competencia): Promise<ResumoDasNotas>;
  /** Pendentes de NFS-e com competência até a informada, para o lote. */
  abstract pendentesDoLote(ate: Competencia): Promise<NotaFiscal[]>;
  abstract doAluno(alunoId: string): Promise<NotaFiscal[]>;
  /** LGPD: tira o aluno e o CPF; nome vira "Titular removido". */
  abstract anonimizarDoAluno(alunoId: string): Promise<number>;
}

export interface DadosFiscais extends RegraDeEmissao {
  razaoSocial: string;
  /** Só dígitos e letras (CNPJ alfanumérico). */
  cnpj: string;
  regime: string;
  municipio: string;
  /** "06.04 - Academia e ginástica". */
  codigoDoServico: string;
  aliquotaIssPontosBase: number;
  enviarAoAluno: boolean;
  certificadoValidade: DataCivil | null;
}

export abstract class RepositorioDaConfiguracaoFiscal {
  abstract obter(): Promise<DadosFiscais | null>;
  abstract salvar(dados: DadosFiscais): Promise<DadosFiscais>;
}

export interface TomadorDaNota {
  nome: string;
  /** Só dígitos. */
  cpf: string;
  email: string | null;
  telefone: string | null;
}

/** O que o fiscal precisa do aluno (o cadastro é do domínio alunos). */
export abstract class AlunosDoFiscal {
  abstract tomador(alunoId: string): Promise<TomadorDaNota | null>;
  /** Nome do plano do contrato vigente. */
  abstract plano(alunoId: string): Promise<string | null>;
}

export interface MensalidadeEmAberto {
  parcelaId: string;
  vencimento: DataCivil;
  saldoCentavos: number;
}

/** O que o fiscal lê da cobrança (T19) para preencher a nota manual. */
export abstract class CobrancaDoFiscal {
  /** Parcela a receber mais antiga do aluno. */
  abstract mensalidadeEmAberto(alunoId: string): Promise<MensalidadeEmAberto | null>;
  abstract formaPreferida(alunoId: string): Promise<string | null>;
}

/** Jobs da fila `notas` do tenant do contexto (o job nunca corre antes do commit que o pediu). */
export abstract class FilaDasNotas {
  abstract tenantId(): string;
  /** Emite (ou confere no emissor) a nota num job. */
  abstract emitir(notaId: string): Promise<void>;
  /** Volta a consultar o emissor mais tarde (nota em processamento ou sem resposta). */
  abstract conferirDepois(notaId: string, tentativa: number): Promise<void>;
}

// ---------- Emissor fiscal terceirizado (ADR-008) ----------

export interface PedidoDeEmissao {
  /** Id da nota: chave de idempotência no emissor. */
  chave: string;
  tipo: TipoDeNota;
  prestador: Pick<DadosFiscais, 'razaoSocial' | 'cnpj' | 'regime' | 'municipio'>;
  tomador: { nome: string; cpf: string | null; email: string | null };
  descricao: string;
  codigoDoServico: string;
  competencia: Competencia;
  valorCentavos: number;
  aliquotaIssPontosBase: number;
  issCentavos: number;
  retencoesCentavos: number;
}

export type ResultadoNoEmissor =
  | { situacao: 'emitida'; numero: string; emitidaEm: Date; pdf: Buffer; xml: string }
  | { situacao: 'rejeitada'; motivo: string }
  | { situacao: 'processando' }
  | { situacao: 'cancelada' }
  /** Só na consulta: o emissor não conhece a chave. */
  | { situacao: 'desconhecida' };

/** Sem resposta do emissor (tempo esgotado, conexão caiu): a nota pode ou não ter sido aceita. */
export class FalhaDeComunicacaoComOEmissorError extends Error {
  constructor(mensagem = 'O emissor fiscal não respondeu.') {
    super(mensagem);
    this.name = 'FalhaDeComunicacaoComOEmissorError';
  }
}

/** Recusa de negócio do emissor (ex.: cancelar o que ele não emitiu). */
export class EmissorRecusouError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'EmissorRecusouError';
  }
}

export interface EventoDoEmissor {
  chave: string;
  resultado: ResultadoNoEmissor;
}

/**
 * Porta do emissor fiscal terceirizado (ADR-008; fornecedor ainda não escolhido). `emitir` usa a chave
 * de idempotência; antes de reenviar uma nota que pode já estar no emissor, quem chama consulta pela
 * chave e só reemite se o emissor não a conhece.
 */
export abstract class EmissorFiscal {
  /** Nome do provedor na rota do webhook (`/webhooks/<provedor>/<tenant>`). */
  abstract readonly provedor: string;
  abstract emitir(pedido: PedidoDeEmissao): Promise<ResultadoNoEmissor>;
  abstract consultar(chave: string): Promise<ResultadoNoEmissor>;
  abstract cancelar(chave: string, motivo: string): Promise<void>;
  /** Envia o certificado A1 ao emissor; devolve a validade lida do certificado. */
  abstract enviarCertificado(arquivo: Buffer, senha: string): Promise<{ validade: DataCivil }>;
  abstract assinaturaValida(
    corpo: unknown,
    cabecalhos: Record<string, string | undefined>,
  ): boolean;
  abstract interpretar(corpo: unknown): EventoDoEmissor | null;
}
