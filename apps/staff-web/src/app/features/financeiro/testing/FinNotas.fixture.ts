import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { SESSAO_DA_GERENTE } from './sessao-da-gerente.fixture';

type Nota = Schemas['NotaFiscalDto'];

const base: Omit<
  Nota,
  'id' | 'tipo' | 'tipoExibido' | 'situacao' | 'numero' | 'rotulo' | 'cliente' | 'descricao'
> = {
  alunoId: null,
  codigoDoServico: '06.04 - Academia e ginástica',
  competencia: '2026-11',
  competenciaExibida: '11/2026',
  valorCentavos: 11900,
  aliquotaIssPontosBase: 250,
  issCentavos: 298,
  retencoesCentavos: 0,
  totalCentavos: 11900,
  formaDePagamento: 'PIX',
  motivoDaRejeicao: null,
  motivoDoCancelamento: null,
  data: '2026-11-10T13:00:00.000Z',
  emitidaEm: '2026-11-10T13:00:00.000Z',
  canceladaEm: null,
  temPdf: true,
  temXml: true,
  registradaNaFicha: true,
  enviadaAoAlunoEm: null,
  acao: 'ver',
  atencao: 'Emitida',
};

const nfse = (id: string, numero: string, extra: Partial<Nota>): Nota => ({
  ...base,
  id,
  tipo: 'nfse',
  tipoExibido: 'NFS-e',
  situacao: 'emitida',
  numero,
  rotulo: Number(numero).toLocaleString('pt-BR'),
  cliente: '',
  descricao: 'Mensalidade',
  ...extra,
});

const nfce = (id: string, numero: string, extra: Partial<Nota>): Nota => ({
  ...base,
  id,
  tipo: 'nfce',
  tipoExibido: 'NFC-e',
  situacao: 'emitida',
  numero,
  rotulo: `NFC ${numero}`,
  cliente: '',
  descricao: '',
  ...extra,
});

/** As sete linhas de "Notas do mês" de `FinNotas.html`, na mesma ordem. */
export const NOTAS_DO_MES: readonly Nota[] = [
  nfse('00000000-0000-4000-8000-000000001287', '1287', { cliente: 'Paulo Reis' }),
  nfse('00000000-0000-4000-8000-000000001286', '1286', {
    cliente: 'Pedro Almeida',
    descricao: 'Plano anual',
    valorCentavos: 10533,
  }),
  nfce('00000000-0000-4000-8000-000000000412', '0412', {
    cliente: 'Marina Costa',
    descricao: 'Whey protein',
    valorCentavos: 12900,
    data: '2026-11-19T13:00:00.000Z',
  }),
  nfse('00000000-0000-4000-8000-000000001285', '1285', {
    cliente: 'Juliana Prado',
    situacao: 'pendente',
    acao: 'emitir',
    atencao: 'Aguardando pagamento',
    data: '2026-11-12T13:00:00.000Z',
    emitidaEm: null,
  }),
  nfce('00000000-0000-4000-8000-000000000411', '0411', {
    cliente: 'Larissa Nunes',
    descricao: 'Camiseta dry',
    valorCentavos: 5900,
    data: '2026-11-18T13:00:00.000Z',
  }),
  nfse('00000000-0000-4000-8000-000000001284', '1284', {
    cliente: 'Rafael Souza',
    situacao: 'rejeitada',
    acao: 'corrigir',
    motivoDaRejeicao: 'CPF inválido na nota',
    atencao: 'CPF inválido na nota',
    data: '2026-11-09T13:00:00.000Z',
    emitidaEm: null,
  }),
  nfse('00000000-0000-4000-8000-000000001283', '1283', {
    cliente: 'Camila Duarte',
    descricao: 'Plano trimestral',
    valorCentavos: 26700,
    situacao: 'cancelada',
    data: '2026-11-08T13:00:00.000Z',
  }),
];

const resumo: Schemas['ResumoDasNotasDto'] = {
  competencia: '2026-11',
  competenciaPorExtenso: 'Novembro 2026',
  emitidas: 312,
  valorFaturadoCentavos: 5490000,
  pendentes: 4,
  rejeitadas: 2,
  emitidasPorTipo: { nfse: 212, nfce: 100 },
};

/**
 * Fixture de `/financeiro/notas-fiscais` (ADR-019): os números e as linhas de `FinNotas.html`, com a
 * gerente logada. Relógio padrão (19/11/2026 09:00).
 */
export default {
  respostas: [
    ...SESSAO_DA_GERENTE,
    { caminho: '/notas-fiscais/resumo', corpo: resumo },
    { caminho: '/notas-fiscais?limite=20', corpo: { itens: NOTAS_DO_MES, proximoCursor: null } },
    {
      caminho: '/notas-fiscais/atencao',
      corpo: [NOTAS_DO_MES[5], NOTAS_DO_MES[3]],
    },
  ],
} satisfies FixtureDeTela;
