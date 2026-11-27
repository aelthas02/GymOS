import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';
import { planosDoFixture, respostasDaSessao } from './sessao.fixture';

export const ID_DO_ALUNO = '9c2e5a10-4d7b-4f31-8a52-000000000007';
const ID_DO_PROFESSOR = '3b8d1e70-52a4-4c0e-9d11-0000000000d1';
const mensal = planosDoFixture[0];

const aluno: Schemas['AlunoDto'] = {
  id: ID_DO_ALUNO,
  nome: 'Paulo Reis',
  cpf: '12345678909',
  telefone: '11999990000',
  email: 'paulo.reis@email.com',
  dataNascimento: '1990-04-12',
  meta: 'hipertrofia',
  restricoes: null,
  leadId: null,
  professorId: ID_DO_PROFESSOR,
  unidadeId: '1e4a6b20-8c3d-4a95-b7f0-0000000000a1',
  criadoEm: '2026-03-10T12:00:00.000Z',
};

const contrato: Schemas['ContratoDto'] = {
  id: '5d0c7e91-6a2b-4b83-9f44-0000000000c1',
  alunoId: ID_DO_ALUNO,
  planoId: mensal?.id ?? '',
  planoNome: 'Mensal',
  estado: 'ativo',
  inicio: '2026-03-10',
  fim: '2026-12-09',
  vigenteAte: '2026-12-09T23:59:59-03:00',
  parcelas: 1,
  valorTotalCentavos: 11900,
  proximoVencimento: '2026-12-10',
  vencimentoEmAtraso: null,
  encerradoEm: null,
  motivoDoEncerramento: null,
  trancadoDesde: null,
  trancadoAte: null,
};

const situacao: Schemas['SituacaoDoAlunoDto'] = {
  alunoId: ID_DO_ALUNO,
  contrato,
  avaliacao: {
    estado: 'ativo',
    diasDeAtraso: 0,
    encerraEmDias: null,
    encerradoEm: null,
    motivoDoEncerramento: null,
  },
  situacaoDeVencimento: 'em_dia',
};

const pagamentos: Schemas['PagamentoDto'][] = [
  {
    id: '8e1f2a30-7b4c-4d95-a6e1-0000000000b1',
    canal: 'provedor',
    cobrancaId: null,
    parcelaId: null,
    confirmadoEm: '2026-11-10T13:00:00.000Z',
    emDuplicidade: false,
    estornadoCentavos: 0,
    forma: 'pix',
    origem: 'mensalidade',
    setor: 'academia',
    situacao: 'confirmado',
    taxaCentavos: 118,
    valorCentavos: 11900,
  },
];

const profissionais: Schemas['ProfissionalDto'][] = [
  { id: ID_DO_PROFESSOR, nome: 'Diego', cargo: 'professor', cargoDescricao: null },
];

/**
 * Fixture de `/alunos/:id/acompanhamento` (ADR-019). Só traz o que já tem endpoint: aluno, contrato,
 * pagamentos. Frequência, carga, esforço, ficha e observações do professor (T23a, T25) ficam fora e a
 * tela os mostra vazios. Relógio padrão.
 */
export default {
  respostas: [
    ...respostasDaSessao,
    { caminho: `/alunos/${ID_DO_ALUNO}`, corpo: aluno },
    { caminho: `/alunos/${ID_DO_ALUNO}/contrato`, corpo: contrato },
    { caminho: `/alunos/${ID_DO_ALUNO}/situacao`, corpo: situacao },
    { caminho: `/cobranca/alunos/${ID_DO_ALUNO}/pagamentos`, corpo: pagamentos },
    { caminho: `/cobranca/alunos/${ID_DO_ALUNO}/parcelas`, corpo: [] },
    { caminho: '/funcionarios/profissionais', corpo: profissionais },
  ],
} satisfies FixtureDeTela;
