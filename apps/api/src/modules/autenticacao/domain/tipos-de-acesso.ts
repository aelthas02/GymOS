import { type Permissao, TODAS_AS_PERMISSOES, todasAsAcoes } from './permissoes';

export type ChaveDoTipoPadrao =
  'administrador' | 'gerente' | 'recepcao' | 'professor' | 'nutricionista' | 'sem-acesso';

export interface TipoDeAcesso {
  id: string;
  /** Só os tipos padrão têm chave; os criados pela academia, não. */
  chave: string | null;
  nome: string;
  permissoes: readonly Permissao[];
}

export interface TipoPadrao {
  chave: ChaveDoTipoPadrao;
  nome: string;
  permissoes: readonly Permissao[];
}

const VER_E_ALTERAR = ['ver', 'criar', 'editar'] as const;
const verEAlterar = (...modulos: string[]): Permissao[] =>
  modulos.flatMap((modulo) => VER_E_ALTERAR.map((acao): Permissao => `${modulo}:${acao}`));
const ver = (...modulos: string[]): Permissao[] =>
  modulos.map((modulo): Permissao => `${modulo}:ver`);

/** O que todo login da equipe faz em Configurações: ver a página e trocar a própria senha. */
const BASE_DA_EQUIPE: Permissao[] = [
  'inicio:ver',
  'configuracoes:ver',
  'configuracoes.senha:ver',
  'configuracoes.senha:editar',
];

/**
 * Tipos padrão da tela Permissões. O Gerente faz tudo menos Permissões (só administrador) e, em
 * Configurações, mexe na identidade visual, na catraca, na tolerância de atraso e na própria senha.
 */
export const TIPOS_PADRAO: readonly TipoPadrao[] = [
  { chave: 'administrador', nome: 'Administrador', permissoes: TODAS_AS_PERMISSOES },
  {
    chave: 'gerente',
    nome: 'Gerente',
    permissoes: [
      ...BASE_DA_EQUIPE,
      ...todasAsAcoes(
        'recepcao',
        'alunos',
        'planos',
        'financeiro',
        'crm',
        'acesso',
        'treinos',
        'relatorios',
        'equipe',
        'aulas',
        'marketing',
        'loja',
        'saude',
      ),
      ...ver('configuracoes.identidade', 'configuracoes.catraca', 'configuracoes.contratos'),
      'configuracoes.identidade:editar',
      'configuracoes.catraca:editar',
      'configuracoes.contratos:editar',
    ],
  },
  {
    chave: 'recepcao',
    nome: 'Recepção',
    permissoes: [
      ...BASE_DA_EQUIPE,
      ...verEAlterar('recepcao', 'alunos', 'crm', 'aulas'),
      ...ver('planos', 'financeiro', 'acesso', 'treinos', 'loja'),
      'financeiro:criar',
      'acesso:criar',
      'loja:criar',
    ],
  },
  {
    chave: 'professor',
    nome: 'Professor',
    permissoes: [
      ...BASE_DA_EQUIPE,
      ...ver('alunos', 'acesso', 'saude'),
      ...todasAsAcoes('treinos'),
      ...verEAlterar('aulas'),
    ],
  },
  {
    chave: 'nutricionista',
    nome: 'Nutricionista',
    permissoes: [...BASE_DA_EQUIPE, ...ver('alunos'), ...todasAsAcoes('saude')],
  },
  { chave: 'sem-acesso', nome: 'Sem acesso', permissoes: [] },
];

/** Permissões que valem para o tipo: o Administrador tem sempre todas, até as de módulos novos. */
export function permissoesEfetivas(tipo: Pick<TipoDeAcesso, 'chave' | 'permissoes'>): Permissao[] {
  return [...(tipo.chave === 'administrador' ? TODAS_AS_PERMISSOES : tipo.permissoes)];
}

export function temPermissao(
  tipo: Pick<TipoDeAcesso, 'chave' | 'permissoes'>,
  permissao: Permissao,
): boolean {
  return permissoesEfetivas(tipo).includes(permissao);
}

/** "Sem acesso" não entra no painel. */
export function podeEntrarNoPainel(tipo: Pick<TipoDeAcesso, 'chave'>): boolean {
  return tipo.chave !== 'sem-acesso';
}
