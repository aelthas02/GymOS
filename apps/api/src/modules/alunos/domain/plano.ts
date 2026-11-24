import { centavos, type Centavos, formatarBrl, ratear } from '@gymos/shared-money';

// Plano vendido pela academia (tela Planos). Dinheiro em centavos; o valor da parcela é derivado do
// total com `ratear` (o resto da divisão fica na última parcela).

export const FORMAS_DE_COBRANCA = ['cartao_ou_pix', 'cartao', 'pix', 'boleto'] as const;
export type FormaDeCobranca = (typeof FORMAS_DE_COBRANCA)[number];

export const MODALIDADES = ['Musculação', 'Spinning', 'Funcional', 'Lutas', 'Aulas'] as const;

export interface DadosDoPlano {
  nome: string;
  valorTotalCentavos: number;
  duracaoMeses: number;
  parcelas: number;
  formaDeCobranca: FormaDeCobranca;
  modalidades: readonly string[];
  /** `null` é ilimitado. */
  acessosPorSemana: number | null;
  renovacaoAutomatica: boolean;
  ativo: boolean;
}

export interface Plano extends DadosDoPlano {
  id: string;
}

export class PlanoInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'PlanoInvalidoError';
  }
}

const inteiroEntre = (valor: number, minimo: number, maximo: number): boolean =>
  Number.isSafeInteger(valor) && valor >= minimo && valor <= maximo;

/** Regras do formulário de plano; a principal: parcelas ≤ duração. */
export function validarPlano(dados: DadosDoPlano): void {
  if (dados.nome.trim() === '') {
    throw new PlanoInvalidoError('O plano precisa de um nome.');
  }
  if (!inteiroEntre(dados.valorTotalCentavos, 1, Number.MAX_SAFE_INTEGER)) {
    throw new PlanoInvalidoError('O valor total precisa ser maior que zero.');
  }
  if (!inteiroEntre(dados.duracaoMeses, 1, 120)) {
    throw new PlanoInvalidoError('A duração precisa ser de 1 a 120 meses.');
  }
  if (!inteiroEntre(dados.parcelas, 1, dados.duracaoMeses)) {
    throw new PlanoInvalidoError(
      `As parcelas (${dados.parcelas}) não podem passar da duração (${dados.duracaoMeses} meses).`,
    );
  }
  if (dados.acessosPorSemana !== null && !inteiroEntre(dados.acessosPorSemana, 1, 7)) {
    throw new PlanoInvalidoError('Os acessos por semana vão de 1 a 7, ou ilimitado.');
  }
  if (!(FORMAS_DE_COBRANCA as readonly string[]).includes(dados.formaDeCobranca)) {
    throw new PlanoInvalidoError(`Forma de cobrança desconhecida: ${dados.formaDeCobranca}.`);
  }
}

export interface ValorDasParcelas {
  parcelas: number;
  /** Valor de cada parcela, menos a última. */
  parcelaCentavos: Centavos;
  /** A última leva o resto da divisão (948,00 em 9x → 105,33 e a última 105,36). */
  ultimaCentavos: Centavos;
}

export function valorDasParcelas(valorTotalCentavos: number, parcelas: number): ValorDasParcelas {
  const rateio = ratear(centavos(valorTotalCentavos), parcelas);
  return {
    parcelas,
    parcelaCentavos: rateio[0] as Centavos,
    ultimaCentavos: rateio[rateio.length - 1] as Centavos,
  };
}

/** Texto explicativo do painel de plano. */
export function explicacaoDoPlano(duracaoMeses: number, parcelas: number): string {
  const meses = duracaoMeses === 1 ? '1 mês' : `${duracaoMeses} meses`;
  const vezes = parcelas === 1 ? '1 parcela' : `${parcelas} parcelas`;
  if (parcelas === duracaoMeses) {
    return `O aluno tem acesso por ${meses} e paga em ${vezes}.`;
  }
  return (
    `O aluno tem acesso por ${meses} e paga em ${vezes}. As cobranças terminam na ` +
    `${parcelas}ª parcela, e o contrato segue ativo até o fim dos ${meses}.`
  );
}

/** Detalhe da auditoria sensível: "Plano Mensal: R$ 109,00 para R$ 119,00". */
export function detalheDaAlteracaoDeValor(nome: string, de: number, para: number): string {
  return `Plano ${nome}: ${formatarBrl(centavos(de))} para ${formatarBrl(centavos(para))}`;
}
