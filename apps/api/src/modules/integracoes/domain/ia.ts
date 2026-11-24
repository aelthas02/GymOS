// GeradorIA (T13d): a plataforma nunca manda a um provedor de IA nome, CPF, telefone nem e-mail.

const CHAVES_PESSOAIS =
  /^(nome|sobrenome|nome_?completo|cpf|rg|telefone|celular|whatsapp|fone|e-?mail|endereco|endereço)/i;

const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Telefone com 10 ou 11 dígitos, com ou sem DDI, parênteses, espaços ou hífens.
const TELEFONE = /(?<!\d)(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}(?!\d)/g;

export const MARCA_REMOVIDA = '[removido]';

/** Troca e-mail, CPF e telefone que aparecem no meio de um texto. */
export function limparTexto(texto: string): string {
  return texto
    .replace(EMAIL, MARCA_REMOVIDA)
    .replace(CPF, MARCA_REMOVIDA)
    .replace(TELEFONE, MARCA_REMOVIDA);
}

/** Copia o valor sem as chaves de dado pessoal e com os textos limpos, em qualquer profundidade. */
export function removerDadosPessoais(valor: unknown): unknown {
  if (typeof valor === 'string') {
    return limparTexto(valor);
  }
  if (Array.isArray(valor)) {
    return valor.map(removerDadosPessoais);
  }
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave]) => !CHAVES_PESSOAIS.test(chave))
        .map(([chave, interno]) => [chave, removerDadosPessoais(interno)]),
    );
  }
  return valor;
}

/** Estimativa grosseira (4 caracteres por token) para o registro de uso. */
export function estimarTokens(texto: string): number {
  return Math.max(1, Math.ceil(texto.length / 4));
}
