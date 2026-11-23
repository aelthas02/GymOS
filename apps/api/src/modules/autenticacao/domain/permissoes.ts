// Catálogo de permissões como código (tela Permissões). Uma permissão é `modulo:acao`; os módulos
// são os do menu, as seções de Configurações e os módulos extras.

export const ACOES = ['ver', 'criar', 'editar', 'excluir'] as const;
export type Acao = (typeof ACOES)[number];

export const MODULOS_EXTRAS = ['aulas', 'marketing', 'loja', 'saude'] as const;
export type ModuloExtra = (typeof MODULOS_EXTRAS)[number];

export interface ModuloDoCatalogo {
  chave: string;
  nome: string;
  /** Seção de Configurações: aparece agrupada sob `configuracoes` na tela. */
  secaoDe?: 'configuracoes';
  extra?: true;
}

export const CATALOGO_DE_MODULOS: readonly ModuloDoCatalogo[] = [
  { chave: 'inicio', nome: 'Início' },
  { chave: 'recepcao', nome: 'Recepção' },
  { chave: 'alunos', nome: 'Alunos' },
  { chave: 'planos', nome: 'Planos' },
  { chave: 'financeiro', nome: 'Financeiro' },
  { chave: 'crm', nome: 'CRM e vendas' },
  { chave: 'acesso', nome: 'Acesso e frequência' },
  { chave: 'treinos', nome: 'Treinos' },
  { chave: 'relatorios', nome: 'Relatórios' },
  { chave: 'equipe', nome: 'Equipe' },
  { chave: 'permissoes', nome: 'Permissões' },
  { chave: 'configuracoes', nome: 'Configurações' },
  { chave: 'configuracoes.identidade', nome: 'Identidade visual do app', secaoDe: 'configuracoes' },
  {
    chave: 'configuracoes.redes-sociais',
    nome: 'Redes sociais e WhatsApp',
    secaoDe: 'configuracoes',
  },
  { chave: 'configuracoes.alertas', nome: 'Alertas de frequência', secaoDe: 'configuracoes' },
  { chave: 'configuracoes.fiscal', nome: 'Dados fiscais e notas', secaoDe: 'configuracoes' },
  { chave: 'configuracoes.catraca', nome: 'Catraca', secaoDe: 'configuracoes' },
  { chave: 'configuracoes.contratos', nome: 'Contratos e atraso', secaoDe: 'configuracoes' },
  { chave: 'configuracoes.senha', nome: 'Alterar senha', secaoDe: 'configuracoes' },
  { chave: 'aulas', nome: 'Aulas', extra: true },
  { chave: 'marketing', nome: 'Marketing', extra: true },
  { chave: 'loja', nome: 'Loja', extra: true },
  { chave: 'saude', nome: 'Saúde', extra: true },
];

export type Permissao = `${string}:${Acao}`;

const CHAVES = new Set(CATALOGO_DE_MODULOS.map((modulo) => modulo.chave));

export function ehPermissao(valor: string): valor is Permissao {
  const [modulo, acao, ...resto] = valor.split(':');
  return (
    resto.length === 0 &&
    CHAVES.has(modulo ?? '') &&
    (ACOES as readonly string[]).includes(acao ?? '')
  );
}

export function ehModuloExtra(valor: string): valor is ModuloExtra {
  return (MODULOS_EXTRAS as readonly string[]).includes(valor);
}

/** Todas as ações de cada módulo informado. */
export function todasAsAcoes(...modulos: string[]): Permissao[] {
  return modulos.flatMap((modulo) => ACOES.map((acao): Permissao => `${modulo}:${acao}`));
}

export const TODAS_AS_PERMISSOES: readonly Permissao[] = todasAsAcoes(
  ...CATALOGO_DE_MODULOS.map((modulo) => modulo.chave),
);

/** Módulo de uma permissão (`alunos:excluir` → `alunos`). */
export function moduloDa(permissao: Permissao): string {
  return permissao.slice(0, permissao.lastIndexOf(':'));
}
