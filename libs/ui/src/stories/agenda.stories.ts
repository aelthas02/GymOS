import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { AgendaGrid, type AgendaDia, type AgendaLinha } from '../lib/agenda-grid/agenda-grid';
import { WeekGrid, type WeekDay } from '../lib/week-grid/week-grid';

const meta: Meta = {
  title: 'Compostos/Semana e agenda',
  decorators: [moduleMetadata({ imports: [WeekGrid, AgendaGrid] })],
};

export default meta;

type Story = StoryObj;

const tinta = (cor: string): string => `color-mix(in srgb, ${cor} 22%, var(--surface))`;

/** Grade da semana (`AulasGrade.html`); a aula sem professor leva contorno de alerta. */
const aulas: WeekDay[] = [
  {
    label: 'Seg',
    items: [
      {
        id: 'seg-0630',
        time: '06h30',
        title: 'CrossFit',
        color: tinta('var(--mod-aulas)'),
        lines: [{ text: 'Diego' }, { text: '18/22' }],
      },
      {
        id: 'seg-0730',
        time: '07h30',
        title: 'Pilates',
        color: tinta('var(--mod-saude)'),
        lines: [{ text: 'Lia' }, { text: '10/14' }],
      },
      {
        id: 'seg-1830',
        time: '18h30',
        title: 'Spinning',
        color: tinta('var(--chart-2)'),
        alert: true,
        lines: [{ text: 'Sem professor', tone: 'danger' }, { text: '20/26' }],
      },
    ],
  },
  {
    label: 'Ter',
    items: [
      {
        id: 'ter-0630',
        time: '06h30',
        title: 'CrossFit',
        color: tinta('var(--mod-aulas)'),
        lines: [{ text: 'Diego' }, { text: '17/22' }],
      },
      {
        id: 'ter-1930',
        time: '19h30',
        title: 'Jiu-Jitsu',
        color: tinta('var(--chart-3)'),
        lines: [{ text: 'Marcos' }, { text: '11/20' }],
      },
    ],
  },
  { label: 'Qua', items: [] },
];

/** Calendário de marketing (`MktResultados.html`). */
const calendario: WeekDay[] = [
  { label: 'Seg 16', items: [] },
  {
    label: 'Ter 17',
    items: [
      {
        id: 'aula-nova',
        title: 'Aula nova',
        color: 'var(--chart-2)',
        lines: [{ text: 'Instagram' }],
      },
    ],
  },
  { label: 'Qua 18', items: [] },
  {
    label: 'Qui 19',
    items: [
      {
        id: 'promocao',
        title: 'Promoção',
        color: 'var(--accent)',
        lines: [{ text: 'Insta, Face, WhatsApp' }],
      },
    ],
  },
  {
    label: 'Sex 20',
    items: [
      {
        id: 'lembrete',
        title: 'Lembrete',
        color: 'var(--chart-5)',
        lines: [{ text: 'WhatsApp' }],
      },
    ],
  },
];

export const GradeSemanal: Story = {
  name: 'Grade semanal',
  render: () => ({
    props: { aulas },
    template: `<div style="padding:16px;max-width:560px"><ui-week-grid label="Grade da semana" [days]="aulas" /></div>`,
  }),
};

export const GradeSemanalInterativa: Story = {
  name: 'Grade semanal interativa',
  render: () => ({
    props: { aulas },
    template: `<div style="padding:16px;max-width:560px"><ui-week-grid label="Grade da semana" [interactive]="true" [days]="aulas" /></div>`,
  }),
};

export const CalendarioEmCartoes: Story = {
  name: 'Calendário em cartões',
  render: () => ({
    props: { calendario },
    template: `<div style="padding:16px;max-width:760px"><ui-week-grid label="Publicações agendadas" variant="cartoes" [days]="calendario" /></div>`,
  }),
};

const dias: AgendaDia[] = [
  { label: 'Seg 16' },
  { label: 'Ter 17' },
  { label: 'Qua 18' },
  { label: 'Qui 19', hoje: true },
  { label: 'Sex 20' },
];

const linhas: AgendaLinha[] = [
  {
    hora: '08h',
    celulas: [
      { estado: 'livre' },
      { estado: 'livre' },
      { estado: 'livre' },
      { estado: 'nao-compareceu', nome: 'Lucas' },
      { estado: 'livre' },
    ],
  },
  {
    hora: '09h',
    celulas: [
      { estado: 'realizada', nome: 'Ana' },
      { estado: 'livre' },
      { estado: 'realizada', nome: 'Davi' },
      { estado: 'aguardando', nome: 'Paulo Reis' },
      { estado: 'confirmada', nome: 'Larissa' },
    ],
  },
  {
    hora: '11h',
    celulas: [
      { estado: 'realizada', nome: 'Lucas' },
      { estado: 'livre' },
      { estado: 'cancelada', nome: 'Ana' },
      { estado: 'livre' },
      { estado: 'confirmada', nome: 'Pedro' },
    ],
  },
  {
    hora: '12h',
    celulas: Array.from({ length: 5 }, () => ({ estado: 'almoco' as const })),
  },
];

/** Agenda da nutricionista (`SaudeNutricao.html`), com todos os estados. */
export const AgendaPorHora: Story = {
  name: 'Agenda por hora',
  render: () => ({
    props: { dias, linhas },
    template: `<div style="padding:16px;max-width:760px"><ui-agenda-grid label="Agenda da semana" [days]="dias" [rows]="linhas" /></div>`,
  }),
};

export const AgendaInterativa: Story = {
  name: 'Agenda interativa',
  render: () => ({
    props: { dias, linhas },
    template: `<div style="padding:16px;max-width:760px"><ui-agenda-grid label="Agenda da semana" [interactive]="true" [days]="dias" [rows]="linhas" /></div>`,
  }),
};
