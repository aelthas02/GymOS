export type TipoDeTelefone = 'celular' | 'fixo';

function faixa(de: number, ate: number): number[] {
  return Array.from({ length: ate - de + 1 }, (_, indice) => de + indice);
}

// DDDs em uso no Brasil (plano de numeração da Anatel).
const DDDS = new Set([
  ...faixa(11, 19),
  21,
  22,
  24,
  27,
  28,
  ...faixa(31, 35),
  37,
  38,
  ...faixa(41, 49),
  51,
  ...faixa(53, 55),
  ...faixa(61, 69),
  71,
  ...faixa(73, 75),
  77,
  79,
  ...faixa(81, 89),
  ...faixa(91, 99),
]);

// DDD com ou sem parênteses, +55 opcional; celular com 9 dígitos começando em 9, fixo com 8
// começando de 2 a 5.
const FORMATO_TELEFONE = /^(?:\+55)?\(?(\d{2})\)?(?:(9\d{8})|[2-5]\d{7})$/;

const ATOMO = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const ROTULO = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?';
const FORMATO_EMAIL = new RegExp(`^${ATOMO}(?:\\.${ATOMO})*@(?:${ROTULO}\\.)+[A-Za-z]{2,63}$`);
const TAMANHO_MAXIMO_DO_EMAIL = 254;

const FORMATO_CEP = /^\d{5}-?\d{3}$/;

/** '(11) 99999-0000' → 'celular'; '(11) 3333-4444' → 'fixo'; o que não for telefone BR → null. */
export function tipoDeTelefone(valor: string): TipoDeTelefone | null {
  const partes = FORMATO_TELEFONE.exec(valor.replace(/[\s-]/g, ''));
  if (!partes || !DDDS.has(Number(partes[1]))) {
    return null;
  }
  return partes[2] ? 'celular' : 'fixo';
}

/** Telefone BR fixo ou celular; com `tipo`, só aquele tipo. */
export function validarTelefone(valor: string, tipo?: TipoDeTelefone): boolean {
  const encontrado = tipoDeTelefone(valor);
  return encontrado !== null && (tipo === undefined || encontrado === tipo);
}

export function validarEmail(valor: string): boolean {
  const texto = valor.trim();
  return texto.length <= TAMANHO_MAXIMO_DO_EMAIL && FORMATO_EMAIL.test(texto);
}

export function validarCep(valor: string): boolean {
  const texto = valor.trim();
  return FORMATO_CEP.test(texto) && texto.replace('-', '') !== '00000000';
}
