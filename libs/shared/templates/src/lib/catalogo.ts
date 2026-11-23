/** Variáveis que o resolvedor (T13d) troca pelos dados de cada aluno, com a descrição para a UI. */
export const VARIAVEIS_DE_MENSAGEM = {
  nome: 'Nome do aluno',
  plano: 'Plano do aluno',
  vencimento: 'Data de vencimento',
  professor: 'Professor do aluno',
  valor: 'Valor da mensalidade',
  link: 'Link de pagamento',
} as const;

export type VariavelDeMensagem = keyof typeof VARIAVEIS_DE_MENSAGEM;

export type ContextoDeMensagem = 'cobranca' | 'marketing';

/** O link de pagamento só cabe em cobrança; mensagem de marketing não leva link de cobrança. */
export const CATALOGO_POR_CONTEXTO: Readonly<
  Record<ContextoDeMensagem, readonly VariavelDeMensagem[]>
> = {
  cobranca: ['nome', 'plano', 'vencimento', 'professor', 'valor', 'link'],
  marketing: ['nome', 'plano', 'vencimento', 'professor', 'valor'],
};

export const NOME_DO_CONTEXTO: Readonly<Record<ContextoDeMensagem, string>> = {
  cobranca: 'cobrança',
  marketing: 'marketing',
};

export function ehVariavelDeMensagem(nome: string): nome is VariavelDeMensagem {
  return Object.hasOwn(VARIAVEIS_DE_MENSAGEM, nome);
}
