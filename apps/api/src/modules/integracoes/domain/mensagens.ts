import type { ContextoDeMensagem } from '@gymos/shared-templates';

// Mensageria (T13d): finalidades, canais e as regras de texto que não dependem de infraestrutura.

/** Só estas duas finalidades têm mensagem; saúde e biometria não são canal de envio. */
export const FINALIDADES_DE_MENSAGEM = ['transacional', 'marketing'] as const;
export type FinalidadeDeMensagem = (typeof FINALIDADES_DE_MENSAGEM)[number];

export const CANAIS_DE_MENSAGEM = ['whatsapp', 'email'] as const;
export type CanalDeMensagem = (typeof CANAIS_DE_MENSAGEM)[number];

export type MotivoDaRecusa =
  | 'sem_consentimento'
  | 'aluno_nao_encontrado'
  | 'sem_canal'
  | 'sem_telefone'
  | 'sem_email'
  | 'whatsapp_nao_conectado'
  | 'modelo_invalido'
  | 'falha_no_provedor';

export const TEXTO_DO_MOTIVO: Readonly<Record<MotivoDaRecusa, string>> = {
  sem_consentimento: 'O aluno não aceitou receber mensagens de marketing.',
  aluno_nao_encontrado: 'Aluno não encontrado.',
  sem_canal: 'O aluno não tem telefone nem e-mail cadastrados.',
  sem_telefone: 'O aluno não tem telefone cadastrado.',
  sem_email: 'O aluno não tem e-mail cadastrado.',
  whatsapp_nao_conectado: 'O WhatsApp da academia não está conectado.',
  modelo_invalido: 'O modelo da mensagem é inválido.',
  falha_no_provedor: 'O provedor não aceitou a mensagem.',
};

export type EstadoDaMensagem = 'enviada' | 'entregue' | 'lida' | 'recusada' | 'falha' | 'recebida';

/** Modelo usado na cobrança quando quem envia não traz o seu. */
export const MODELO_DE_COBRANCA =
  'Olá, {nome}! Sua mensalidade de {valor} vence em {vencimento}. Pague por aqui: {link}';

export const ASSUNTO_PADRAO: Readonly<Record<ContextoDeMensagem, string>> = {
  cobranca: 'Cobrança da sua academia',
  marketing: 'Novidades da sua academia',
};

/** "SAIR" (qualquer caixa, com pontuação ou espaços ao redor) revoga o consentimento de marketing. */
export function ehPedidoDeSaida(texto: string): boolean {
  return (
    texto
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .toUpperCase() === 'SAIR'
  );
}
