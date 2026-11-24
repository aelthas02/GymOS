import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Button } from '../lib/button/button';
import { PageHeader } from '../lib/shell/page-header';
import {
  TutorialOverlay,
  type ConfiguracaoDeTutorial,
} from '../lib/tutorial-overlay/tutorial-overlay';
import { roteadorEm } from './router';

const meta: Meta<TutorialOverlay> = {
  title: 'Componentes/Tutorial da tela',
  component: TutorialOverlay,
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({ imports: [TutorialOverlay, PageHeader, Button] }),
    applicationConfig({ providers: roteadorEm('/alunos') }),
  ],
};

export default meta;

type Story = StoryObj<TutorialOverlay>;

const configuracao: ConfiguracaoDeTutorial = {
  passos: [
    { alvo: 'cabecalho', numero: 1, texto: 'Título da tela e botão de cadastro' },
    { alvo: 'filtros', numero: 2, texto: 'Busque e filtre os alunos' },
    { alvo: 'lista', numero: 3, texto: 'Lista com situação e plano de cada aluno' },
    { alvo: 'resumo', numero: 4, texto: 'Resumo da carteira' },
    { alvo: 'bloco-desligado', numero: 5, texto: 'Módulo desligado: este passo é ignorado' },
  ],
};

const pagina = `<div style="padding:24px;display:flex;flex-direction:column;gap:16px;max-width:980px">
  <div data-tutorial="cabecalho" style="border-radius:18px">
    <ui-page-header heading="Alunos" subtitle="Cadastro, planos e situação de pagamento." (helpClick)="aberto = true">
      <ui-button actions variant="accent">Cadastrar aluno</ui-button>
    </ui-page-header>
  </div>
  <div data-tutorial="filtros" style="border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:16px;font-size:14px">Buscar por nome ou CPF</div>
  <div data-tutorial="lista" style="border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:16px;height:220px;font-size:14px">Rafael Souza, Juliana Prado, Pedro Almeida</div>
  <div data-tutorial="resumo" style="border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:16px;font-size:14px">128 alunos ativos</div>
  <ui-tutorial-overlay [config]="config" [(open)]="aberto" />
</div>`;

export const Aberto: Story = {
  name: 'Overlay aberto (4 blocos)',
  render: () => ({ props: { aberto: true, config: configuracao }, template: pagina }),
};

export const Fechado: Story = {
  name: 'Fechado (botão "?" abre)',
  render: () => ({ props: { aberto: false, config: configuracao }, template: pagina }),
};
