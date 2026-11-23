import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Card } from '../lib/card/card';
import { Kpi } from '../lib/kpi/kpi';

const meta: Meta<Card> = {
  title: 'Componentes/Card e KPI',
  component: Card,
  decorators: [moduleMetadata({ imports: [Card, Kpi] })],
};

export default meta;

type Story = StoryObj<Card>;

export const Padrao: Story = {
  name: 'Padrão',
  render: () => ({
    template: `<div style="padding:16px;max-width:420px">
      <ui-card>
        <h2 style="margin:0;font-size:16px;font-weight:700">Frequência por horário</h2>
        <p style="margin:3px 0 0;font-size:13px;color:var(--muted)">Check-ins em cada hora do dia, média dos últimos 30 dias. Pico às 18h.</p>
      </ui-card>
    </div>`,
  }),
};

/** "Hoje na academia", de Main.html. */
export const Inverso: Story = {
  render: () => ({
    template: `<div style="padding:16px;max-width:420px">
      <ui-card [inverse]="true">
        <h2 style="margin:0 0 12px;font-size:16px;font-weight:700">Hoje na academia</h2>
        <div style="font-size:26px;font-weight:700;color:var(--accent)">187</div>
        <div style="font-size:12px;color:var(--nav-card-fg)">Check-ins até agora</div>
      </ui-card>
    </div>`,
  }),
};

export const Indicadores: Story = {
  render: () => ({
    template: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;padding:16px">
      <ui-kpi label="Receita bruta" value="R$ 54.900" legend="Antes de taxas e despesas" delta="+8,2%" trend="up" />
      <ui-kpi label="Taxas" value="R$ 1.980" legend="Cartão, boleto e PIX" delta="-3%" trend="down" />
      <ui-kpi label="Alunos ativos" value="312" delta="0%" trend="flat" />
    </div>`,
  }),
};
