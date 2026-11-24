import type { NavSection } from '@gymos/ui';

interface ItemDoMenu {
  readonly label: string;
  readonly link: string;
  readonly icon: string;
  /** Módulo cuja permissão `modulo:ver` libera o item; nos extras é também o módulo do plano. */
  readonly modulo: string;
  readonly exact?: boolean;
}

/** Itens do sistema base (`Main.html`), na ordem do menu. */
const BASE: readonly ItemDoMenu[] = [
  { label: 'Início', link: '/inicio', icon: 'home', modulo: 'inicio', exact: true },
  { label: 'Recepção', link: '/recepcao', icon: 'qr', modulo: 'recepcao' },
  { label: 'Alunos', link: '/alunos', icon: 'user', modulo: 'alunos' },
  { label: 'Planos', link: '/planos', icon: 'list', modulo: 'planos' },
  { label: 'Financeiro', link: '/financeiro', icon: 'bag', modulo: 'financeiro' },
  { label: 'CRM e vendas', link: '/crm', icon: 'chat', modulo: 'crm' },
  { label: 'Acesso e frequência', link: '/acesso', icon: 'lock', modulo: 'acesso' },
  { label: 'Treinos', link: '/treinos', icon: 'dumbbell', modulo: 'treinos' },
  { label: 'Relatórios', link: '/relatorios', icon: 'list', modulo: 'relatorios' },
  { label: 'Equipe', link: '/equipe', icon: 'user', modulo: 'equipe' },
  { label: 'Permissões', link: '/permissoes', icon: 'lock', modulo: 'permissoes' },
  { label: 'Configurações', link: '/configuracoes', icon: 'edit', modulo: 'configuracoes' },
];

const EXTRAS: readonly ItemDoMenu[] = [
  { label: 'Aulas', link: '/aulas', icon: 'calendar', modulo: 'aulas' },
  { label: 'Marketing', link: '/marketing', icon: 'bell', modulo: 'marketing' },
  { label: 'Loja', link: '/loja', icon: 'bag', modulo: 'loja' },
  { label: 'Saúde', link: '/saude', icon: 'info', modulo: 'saude' },
];

/**
 * Menu lateral: o item aparece com a permissão `modulo:ver`; os extras, também com o módulo ativo
 * para a academia. O "Sair" fecha o menu (o protótipo não tem outro lugar para ele).
 */
export function montarMenu(
  pode: (permissao: string) => boolean,
  moduloAtivo: (modulo: string) => boolean,
): NavSection[] {
  return [
    { items: BASE.map((item) => ({ ...item, visible: pode(`${item.modulo}:ver`) })) },
    {
      title: 'Módulos extras',
      items: EXTRAS.map((item) => ({
        ...item,
        visible: moduloAtivo(item.modulo) && pode(`${item.modulo}:ver`),
      })),
    },
    { items: [{ label: 'Sair', link: '/sair', icon: 'close' }] },
  ];
}
