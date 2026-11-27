import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';

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

/** Administrador da Ritmo: vê o menu inteiro (como em `Planos.html`) e edita planos. */
const perfil: Schemas['PerfilDto'] = {
  id: '5f0b5a52-0f6a-4d6b-9d37-6f0f7d6d0c01',
  tipo: 'staff',
  nome: 'Carla Souza',
  email: 'carla@academiaritmo.com',
  tipoDeAcesso: { id: '0d2f5c0e-6a6e-4f55-8a43-0d0b2a1f0a01', nome: 'Administrador' },
  modulos: ['aulas', 'marketing', 'loja', 'saude'],
  permissoes: [
    ...MODULOS_DO_MENU.map((modulo) => `${modulo}:ver`),
    'planos:criar',
    'planos:editar',
    'planos:excluir',
  ],
};

const TODAS = ['Musculação', 'Spinning', 'Funcional', 'Lutas', 'Aulas'];

function plano(
  id: number,
  dados: Pick<
    Schemas['PlanoDto'],
    | 'nome'
    | 'valorTotalCentavos'
    | 'duracaoMeses'
    | 'parcelas'
    | 'parcelaCentavos'
    | 'ultimaParcelaCentavos'
    | 'modalidades'
    | 'alunosAtivos'
    | 'ativo'
  >,
): Schemas['PlanoDto'] {
  return {
    id: `7a1f4c2e-3b5d-4e60-9a71-00000000000${id}`,
    formaDeCobranca: 'cartao_ou_pix',
    acessosPorSemana: null,
    renovacaoAutomatica: true,
    ...dados,
  };
}

/** Linhas de `Planos.html`, com os números exatos da tela. */
const planos: Schemas['PlanoDto'][] = [
  plano(1, {
    nome: 'Mensal',
    valorTotalCentavos: 11900,
    duracaoMeses: 1,
    parcelas: 1,
    parcelaCentavos: 11900,
    ultimaParcelaCentavos: 11900,
    modalidades: ['Musculação'],
    alunosAtivos: 142,
    ativo: true,
  }),
  plano(2, {
    nome: 'Trimestral',
    valorTotalCentavos: 29700,
    duracaoMeses: 3,
    parcelas: 3,
    parcelaCentavos: 9900,
    ultimaParcelaCentavos: 9900,
    modalidades: ['Musculação'],
    alunosAtivos: 78,
    ativo: true,
  }),
  plano(3, {
    nome: 'Semestral',
    valorTotalCentavos: 53400,
    duracaoMeses: 6,
    parcelas: 6,
    parcelaCentavos: 8900,
    ultimaParcelaCentavos: 8900,
    modalidades: ['Musculação', 'Aulas'],
    alunosAtivos: 46,
    ativo: true,
  }),
  plano(4, {
    nome: 'Anual',
    valorTotalCentavos: 94800,
    duracaoMeses: 12,
    parcelas: 9,
    parcelaCentavos: 10533,
    ultimaParcelaCentavos: 10536,
    modalidades: TODAS,
    alunosAtivos: 38,
    ativo: true,
  }),
  plano(5, {
    nome: 'Casal',
    valorTotalCentavos: 18900,
    duracaoMeses: 1,
    parcelas: 1,
    parcelaCentavos: 18900,
    ultimaParcelaCentavos: 18900,
    modalidades: ['Musculação'],
    alunosAtivos: 8,
    ativo: true,
  }),
  plano(6, {
    nome: 'Aulas coletivas',
    valorTotalCentavos: 14900,
    duracaoMeses: 1,
    parcelas: 1,
    parcelaCentavos: 14900,
    ultimaParcelaCentavos: 14900,
    modalidades: ['Aulas'],
    alunosAtivos: 0,
    ativo: false,
  }),
];

/** Prévia que a API devolve para o plano do painel de `Planos.html` (948,00 em 12 meses, 9x). */
const previa: Schemas['PreviaDoPlanoDto'] = {
  parcelas: 9,
  parcelaCentavos: 10533,
  ultimaCentavos: 10536,
  explicacao:
    'O aluno tem acesso por 12 meses e paga em 9 parcelas. As cobranças terminam na 9ª parcela, e o contrato segue ativo até o fim dos 12 meses.',
};

/** O que `Planos.html` mostra preenchido no painel (o teste digita estes valores). */
export const planoDoPainel = {
  nome: 'Plano Anual',
  /** Dígitos digitados na máscara de reais: `94800` vira "R$ 948,00". */
  valorTotal: '94800',
  duracaoMeses: '12',
  parcelas: '9',
  valorDaParcela: 'R$ 105,33',
  modalidades: ['Musculação', 'Spinning', 'Funcional'],
} as const;

/**
 * Fixture de `/planos` (ADR-019): a regressão visual roda com a API interceptada. Relógio padrão
 * (19/11/2026 09:00).
 */
export default {
  respostas: [
    { caminho: '/public/tenant', corpo: tenant },
    { caminho: '/auth/staff/refresh', metodo: 'POST', corpo: sessao },
    { caminho: '/me', corpo: perfil },
    { caminho: '/planos', corpo: planos },
    { caminho: /^\/planos\/previa\?/, corpo: previa },
  ],
} satisfies FixtureDeTela;
