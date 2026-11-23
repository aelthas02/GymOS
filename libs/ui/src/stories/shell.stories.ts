import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '../lib/button/button';
import { PageHeader } from '../lib/shell/page-header';
import { SidebarNav, type NavSection } from '../lib/shell/sidebar-nav';
import { AppShell } from '../lib/shell/app-shell';
import { roteadorEm } from './router';

const meta: Meta = {
  title: 'Layout/Menu lateral e cabeçalho',
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({ imports: [SidebarNav, PageHeader, AppShell, Button] }),
    applicationConfig({ providers: roteadorEm('/alunos') }),
  ],
};

export default meta;

type Story = StoryObj;

/** Itens de Main.html; os de módulos extras vêm da lista já filtrada pelas flags. */
const secoes: NavSection[] = [
  {
    items: [
      { label: 'Início', link: '/', icon: 'home', exact: true },
      { label: 'Recepção', link: '/recepcao', icon: 'qr' },
      { label: 'Alunos', link: '/alunos', icon: 'user' },
      { label: 'Planos', link: '/planos', icon: 'list' },
      { label: 'Financeiro', link: '/financeiro', icon: 'bag' },
      { label: 'CRM e vendas', link: '/crm', icon: 'chat' },
      { label: 'Acesso e frequência', link: '/acesso', icon: 'lock' },
      { label: 'Treinos', link: '/treinos', icon: 'dumbbell' },
      { label: 'Relatórios', link: '/relatorios', icon: 'list' },
      { label: 'Equipe', link: '/equipe', icon: 'user' },
      { label: 'Permissões', link: '/permissoes', icon: 'lock' },
      { label: 'Configurações', link: '/configuracoes', icon: 'edit' },
    ],
  },
  {
    title: 'Módulos extras',
    items: [
      { label: 'Aulas', link: '/aulas', icon: 'calendar' },
      { label: 'Marketing', link: '/marketing', icon: 'bell' },
      { label: 'Loja', link: '/loja', icon: 'bag' },
      { label: 'Saúde', link: '/saude', icon: 'info', visible: false },
    ],
  },
];

export const MenuLateral: Story = {
  name: 'Menu lateral',
  render: () => ({
    props: { secoes },
    template: `<div style="height:900px"><ui-sidebar-nav [sections]="secoes" /></div>`,
  }),
};

export const MenuRecolhido: Story = {
  name: 'Menu recolhido (tablet)',
  render: () => ({
    props: { secoes },
    template: `<div style="height:900px"><ui-sidebar-nav [sections]="secoes" [collapsed]="true" /></div>`,
  }),
};

export const Cabecalho: Story = {
  name: 'Cabeçalho da página',
  render: () => ({
    template: `<div style="padding:24px 32px;display:flex;flex-direction:column;gap:32px">
      <ui-page-header
        heading="Alunos"
        subtitle="Cadastro, planos e situação de pagamento."
        [breadcrumb]="[{ label: 'Início', link: '/' }, { label: 'Alunos' }]"
      >
        <ui-button actions variant="primary" size="lg">Cadastrar aluno</ui-button>
      </ui-page-header>
      <ui-page-header heading="Bom dia, Carla" subtitle="Quinta, 19 de novembro. Unidade Centro." [help]="false" />
    </div>`,
  }),
};

export const Moldura: Story = {
  name: 'Moldura do painel',
  render: () => ({
    props: { secoes },
    template: `<ui-app-shell [sections]="secoes">
      <ui-page-header heading="Alunos" subtitle="Cadastro, planos e situação de pagamento." />
    </ui-app-shell>`,
  }),
};
