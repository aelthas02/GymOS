import type { Schemas } from '@gymos/api-contracts';
import type { RespostaDeApi } from '../../../../../../e2e/src/fixture-de-tela';

/** Identidade da academia (a mesma de `Login.html`) e a sessão que o guard recupera pelo refresh. */
const tenant: Schemas['IdentidadeDoTenantDto'] = {
  nome: 'Academia Ritmo',
  corDestaque: '#22C98A',
  logotipoUrl: null,
};

const sessao: Schemas['SessaoDto'] = {
  accessToken: 'gymos-dev-token-de-fixture-troque-fora-do-dev',
  expiraEm: '2026-11-19T12:10:00.000Z',
};

const MODULOS_DO_MENU = [
  'inicio',
  'recepcao',
  'alunos',
  'planos',
  'financeiro',
  'crm',
  'acesso',
  'treinos',
  'relatorios',
  'equipe',
  'permissoes',
  'configuracoes',
  'aulas',
  'marketing',
  'loja',
  'saude',
];

/** Administrador da Ritmo: vê o menu inteiro (como nas telas de Alunos) e gerencia alunos. */
const perfil: Schemas['PerfilDto'] = {
  id: '5f0b5a52-0f6a-4d6b-9d37-6f0f7d6d0c01',
  tipo: 'staff',
  nome: 'Carla Souza',
  email: 'carla@academiaritmo.com',
  tipoDeAcesso: { id: '0d2f5c0e-6a6e-4f55-8a43-0d0b2a1f0a01', nome: 'Administrador' },
  modulos: ['aulas', 'marketing', 'loja', 'saude'],
  permissoes: [
    ...MODULOS_DO_MENU.map((modulo) => `${modulo}:ver`),
    'alunos:criar',
    'alunos:editar',
    'alunos:excluir',
    'financeiro:criar',
  ],
};

const PLANOS: readonly (readonly [string, number, number])[] = [
  ['Mensal', 11900, 1],
  ['Trimestral', 29700, 3],
  ['Semestral', 53400, 6],
  ['Anual', 94800, 12],
];

/** Planos que o filtro e a importação conhecem (`Planos.html`). */
export const planosDoFixture: Schemas['PlanoDto'][] = PLANOS.map(
  ([nome, valor, meses], indice) => ({
    id: `7a1f4c2e-3b5d-4e60-9a71-00000000000${indice + 1}`,
    nome,
    valorTotalCentavos: valor,
    duracaoMeses: meses,
    parcelas: meses,
    parcelaCentavos: Math.round(valor / meses),
    ultimaParcelaCentavos: Math.round(valor / meses),
    formaDeCobranca: 'cartao_ou_pix',
    modalidades: ['Musculação'],
    acessosPorSemana: null,
    renovacaoAutomatica: true,
    alunosAtivos: 10,
    ativo: true,
  }),
);

/** O que toda tela do painel pede ao abrir: identidade, sessão, perfil. */
export const respostasDaSessao: readonly RespostaDeApi[] = [
  { caminho: '/public/tenant', corpo: tenant },
  { caminho: '/auth/staff/refresh', metodo: 'POST', corpo: sessao },
  { caminho: '/me', corpo: perfil },
];
