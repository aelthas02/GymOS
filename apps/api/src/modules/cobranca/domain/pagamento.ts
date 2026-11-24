// Pagamento (T19): valor, forma, taxa da transação, origem e setor. O setor é atribuído pela origem;
// o rateio da receita entre setores é do Financeiro (T21).

export const ORIGENS = [
  'mensalidade',
  'plano',
  'aula_avulsa',
  'personal',
  'nutricao',
  'loja',
] as const;
export type Origem = (typeof ORIGENS)[number];

export const SETORES = ['academia', 'aulas', 'personal', 'nutricao', 'loja'] as const;
export type Setor = (typeof SETORES)[number];

const SETOR_DA_ORIGEM: Readonly<Record<Origem, Setor>> = {
  mensalidade: 'academia',
  plano: 'academia',
  aula_avulsa: 'aulas',
  personal: 'personal',
  nutricao: 'nutricao',
  loja: 'loja',
};

export function setorDaOrigem(origem: Origem): Setor {
  return SETOR_DA_ORIGEM[origem];
}

/** Formas de cobrança no provedor de pagamento. */
export const FORMAS_DE_COBRANCA = ['pix', 'cartao', 'boleto', 'link'] as const;
export type FormaDeCobranca = (typeof FORMAS_DE_COBRANCA)[number];

/** Formas aceitas no balcão: dinheiro, PIX e cartão na maquininha. */
export const FORMAS_DO_BALCAO = ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito'] as const;
export type FormaDoBalcao = (typeof FORMAS_DO_BALCAO)[number];

export type FormaDoPagamento = FormaDoBalcao | FormaDeCobranca;

/** Forma de pagamento preferida do aluno (troca da forma de pagamento). */
export const FORMAS_PREFERIDAS = ['pix', 'cartao', 'boleto'] as const;
export type FormaPreferida = (typeof FORMAS_PREFERIDAS)[number];

export const CANAIS = ['balcao', 'provedor'] as const;
export type Canal = (typeof CANAIS)[number];

export const SITUACOES_DO_PAGAMENTO = ['confirmado', 'estornado_parcial', 'estornado'] as const;
export type SituacaoDoPagamento = (typeof SITUACOES_DO_PAGAMENTO)[number];

export interface Pagamento {
  id: string;
  parcelaId: string | null;
  cobrancaId: string | null;
  contratoId: string | null;
  alunoId: string | null;
  valorCentavos: number;
  taxaCentavos: number;
  estornadoCentavos: number;
  forma: FormaDoPagamento;
  canal: Canal;
  origem: Origem;
  setor: Setor;
  situacao: SituacaoDoPagamento;
  /** Segundo pagamento de uma parcela já quitada: não conta para a parcela e fica para estorno. */
  emDuplicidade: boolean;
  provedor: string | null;
  confirmadoEm: Date;
}

export class OperacaoDePagamentoInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'OperacaoDePagamentoInvalidaError';
  }
}

export function disponivelParaEstorno(
  pagamento: Pick<Pagamento, 'valorCentavos' | 'estornadoCentavos'>,
): number {
  return Math.max(0, pagamento.valorCentavos - pagamento.estornadoCentavos);
}

/** Estorno total (sem valor, ou todo o disponível) ou parcial. */
export function estornar(
  pagamento: Pick<Pagamento, 'valorCentavos' | 'estornadoCentavos'>,
  valorCentavos?: number,
): {
  valorCentavos: number;
  estornadoCentavos: number;
  situacao: SituacaoDoPagamento;
  total: boolean;
} {
  const disponivel = disponivelParaEstorno(pagamento);
  const valor = valorCentavos ?? disponivel;
  if (disponivel === 0) {
    throw new OperacaoDePagamentoInvalidaError('O pagamento já foi estornado.');
  }
  if (!Number.isSafeInteger(valor) || valor < 1 || valor > disponivel) {
    throw new OperacaoDePagamentoInvalidaError(
      `O estorno vai de 1 centavo até o disponível (${disponivel} centavos).`,
    );
  }
  const total = valor === disponivel;
  return {
    valorCentavos: valor,
    estornadoCentavos: pagamento.estornadoCentavos + valor,
    situacao: total ? 'estornado' : 'estornado_parcial',
    total,
  };
}
