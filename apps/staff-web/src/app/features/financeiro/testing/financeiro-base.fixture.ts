import type { Schemas } from '@gymos/api-contracts';

type Visao = Schemas['VisaoFinanceiraDto'];
type Indicador = Schemas['IndicadorDto'];
type Coluna = Schemas['ColunaDaTabelaDto'];
type Linha = Schemas['LinhaDaTabelaDto'];

/** Novembro de 2026 na unidade Centro, o período de todas as telas do Financeiro. */
export const PERIODO_DE_NOVEMBRO: Schemas['PeriodoApuradoDto'] = {
  chave: 'este-mes',
  de: '2026-11-01',
  ate: '2026-11-30',
  rotulo: 'Novembro 2026',
  anterior: { de: '2026-10-01', ate: '2026-10-31', rotulo: 'Outubro 2026' },
  escopo: 'Unidade Centro',
};

/** Em centavos, a partir de reais. */
export const reais = (valor: number): number => valor * 100;

export const brl = (rotulo: string, valor: number, legenda: string): Indicador => ({
  rotulo,
  formato: 'brl',
  valor: reais(valor),
  texto: null,
  legenda,
  positivo: false,
});

export const inteiro = (rotulo: string, valor: number, legenda: string): Indicador => ({
  rotulo,
  formato: 'inteiro',
  valor,
  texto: null,
  legenda,
  positivo: false,
});

export const percentualDe = (rotulo: string, valor: number, legenda: string): Indicador => ({
  rotulo,
  formato: 'percentual',
  valor,
  texto: null,
  legenda,
  positivo: false,
});

export const texto = (
  rotulo: string,
  valor: string,
  legenda: string,
  positivo = false,
): Indicador => ({ rotulo, formato: 'texto', valor: 0, texto: valor, legenda, positivo });

export const coluna = (
  chave: string,
  rotulo: string,
  tipo: Coluna['tipo'],
  vazio: string | null = null,
): Coluna => ({ chave, rotulo, tipo, vazio });

export const linha = (
  id: string,
  celulas: Linha['celulas'],
  extras: Partial<Pick<Linha, 'situacao' | 'link'>> = {},
): Linha => ({ id, celulas, situacao: null, link: null, ...extras });

export const visaoFinanceira = (visao: Visao): Visao => visao;

export const OPCOES_DOS_FILTROS: Schemas['OpcoesDosFiltrosDto'] = {
  unidades: [{ id: '00000000-0000-4000-8000-0000000000a1', nome: 'Centro' }],
  planos: [
    { id: '00000000-0000-4000-8000-0000000000b1', nome: 'Mensal' },
    { id: '00000000-0000-4000-8000-0000000000b2', nome: 'Trimestral' },
    { id: '00000000-0000-4000-8000-0000000000b3', nome: 'Semestral' },
    { id: '00000000-0000-4000-8000-0000000000b4', nome: 'Anual' },
  ],
  modalidades: ['Funcional', 'Lutas', 'Musculação', 'Spinning'],
  formas: [
    { chave: 'pix', rotulo: 'PIX' },
    { chave: 'cartao', rotulo: 'Cartão' },
    { chave: 'boleto', rotulo: 'Boleto' },
    { chave: 'dinheiro', rotulo: 'Dinheiro' },
    { chave: 'link', rotulo: 'Link de pagamento' },
  ],
  categorias: [
    { chave: 'folha', rotulo: 'Folha' },
    { chave: 'aluguel', rotulo: 'Aluguel' },
    { chave: 'contas', rotulo: 'Contas' },
    { chave: 'outros', rotulo: 'Outros' },
  ],
};
