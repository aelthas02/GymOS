import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { SESSAO_DA_GERENTE } from './sessao-da-gerente.fixture';

/** Aluna de `FinEmitir.html`; a tela abre com `?alunoId=` (vindo de "Emitir" na lista). */
export const ALUNA_DO_EMITIR = '00000000-0000-4000-8000-0000000000b3';

const previa: Schemas['PreviaDaNotaDto'] = {
  valorCentavos: 11900,
  aliquotaIssPontosBase: 250,
  issCentavos: 298,
  retencoesCentavos: 0,
  totalCentavos: 11900,
  codigoDoServico: '06.04 - Academia e ginástica',
  dadosFiscaisConferidos: true,
};

const sugestao: Schemas['SugestaoDeNotaDto'] = {
  cliente: {
    alunoId: ALUNA_DO_EMITIR,
    nome: 'Juliana Prado',
    cpf: '123.456.789-09',
    email: 'juliana.prado@email.com',
    telefone: '(11) 98888-1122',
  },
  servico: {
    descricao: 'Mensalidade de novembro, plano Mensal',
    codigoDoServico: '06.04 - Academia e ginástica',
    valorCentavos: 11900,
    competencia: '2026-11',
    competenciaExibida: '11/2026',
    parcelaId: '00000000-0000-4000-8000-0000000000c3',
    formaDePagamento: 'PIX',
  },
  dataDeEmissao: '2026-11-19',
  resumo: previa,
};

/** Fixture de `/financeiro/notas-fiscais/emitir` (ADR-019): os dados de `FinEmitir.html`. */
export default {
  respostas: [
    ...SESSAO_DA_GERENTE,
    {
      caminho: `/notas-fiscais/sugestao?alunoId=${ALUNA_DO_EMITIR}&tipo=nfse`,
      corpo: sugestao,
    },
    { caminho: /^\/notas-fiscais\/previa\?valorCentavos=\d+$/, corpo: previa },
  ],
} satisfies FixtureDeTela;
