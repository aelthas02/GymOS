import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { ChatThread, type ChatMessage, type ChatQuickAction } from '../lib/chat-thread/chat-thread';
import { PhonePreview, type PhonePreviewData } from '../lib/phone-preview/phone-preview';
import { VideoEmbed } from '../lib/video-embed/video-embed';

const meta: Meta = {
  title: 'Compostos/Conteúdo',
  decorators: [moduleMetadata({ imports: [ChatThread, PhonePreview, VideoEmbed] })],
};

export default meta;

type Story = StoryObj;

/** Conversa com Rafael Souza (`RecepcaoFalar.html`). */
const mensagens: ChatMessage[] = [
  {
    id: '1',
    direction: 'enviada',
    text: 'Olá, Rafael! Sua mensalidade do plano Mensal venceu em 13/11. Pague pelo app ou pelo PIX: pay.ritmo/rs4k',
    meta: 'Enviada hoje, 09h10, pela recepção',
  },
  { id: '2', direction: 'recebida', text: 'Oi, vou pagar hoje à tarde.', meta: 'Rafael, 09h42' },
  {
    id: '3',
    direction: 'enviada',
    text: 'Combinado! Qualquer dúvida estamos por aqui. Obrigado!',
    meta: 'Enviada hoje, 09h45, pela recepção',
  },
];

const acoes: ChatQuickAction[] = [
  { id: 'link', label: 'Enviar link de pagamento' },
  { id: 'boleto', label: 'Segunda via do boleto' },
  { id: 'data', label: 'Combinar nova data' },
  { id: 'lembrar', label: 'Lembrar vencimento' },
];

export const Conversa: Story = {
  render: () => ({
    props: { mensagens, acoes },
    template: `<div style="max-width:520px;margin:16px;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:var(--surface)">
      <ui-chat-thread label="Conversa com Rafael Souza" [messages]="mensagens" [quickActions]="acoes" />
    </div>`,
  }),
};

const app: PhonePreviewData = {
  kind: 'app',
  appName: 'Academia Ritmo',
  greeting: 'Olá, Paulo',
  highlightLabel: 'Treino de hoje:',
  highlight: 'B, costas e bíceps',
  primaryAction: 'Iniciar treino',
  secondaryAction: 'Ver aulas',
};

const whatsapp: PhonePreviewData = {
  kind: 'whatsapp',
  message:
    'Oi, Camila! Seu plano Trimestral vence em 22/11. Quer renovar agora? É só responder aqui. 💪',
  time: '09:12',
};

const post: PhonePreviewData = {
  kind: 'post',
  account: 'academiaritmo',
  headline: 'Plano anual com 20% de desconto',
  subline: 'Em 9x no cartão',
  caption: 'Comece o ano treinando! Plano anual em até 9x...',
};

export const PreviaDoApp: Story = {
  name: 'Prévia do app',
  render: () => ({
    props: { app },
    template: `<div style="padding:16px;max-width:360px"><ui-phone-preview [preview]="app" /></div>`,
  }),
};

export const PreviaDoAppComOutraCor: Story = {
  name: 'Prévia do app com outra cor',
  render: () => ({
    props: { app },
    template: `<div style="padding:16px;max-width:360px"><ui-phone-preview [preview]="app" accent="#3AA6F0" /></div>`,
  }),
};

export const PreviaDoWhatsapp: Story = {
  name: 'Prévia do WhatsApp',
  render: () => ({
    props: { whatsapp },
    template: `<div style="padding:16px;max-width:360px"><ui-phone-preview [preview]="whatsapp" /></div>`,
  }),
};

export const PreviaDoPost: Story = {
  name: 'Prévia do post',
  render: () => ({
    props: { post },
    template: `<div style="padding:16px"><ui-phone-preview [preview]="post" /></div>`,
  }),
};

/** Fachada: o player do YouTube só é carregado depois do clique. */
export const VideoDoYoutube: Story = {
  name: 'Vídeo do YouTube',
  render: () => ({
    template: `<div style="padding:16px;max-width:560px"><ui-video-embed video="https://www.youtube.com/watch?v=dQw4w9WgXcQ" title="Como fazer o supino reto" /></div>`,
  }),
};
