import { somenteDigitos } from './digitos';

// Com ou sem pontuação, mas a pontuação só nas posições certas.
const FORMATO_CPF = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/;
// CNPJ alfanumérico (IN RFB 2.229/2024, vale desde julho de 2026): letras maiúsculas nas 12 primeiras
// posições; os dois dígitos verificadores continuam numéricos.
const FORMATO_CNPJ = /^[\dA-Z]{2}\.?[\dA-Z]{3}\.?[\dA-Z]{3}\/?[\dA-Z]{4}-?\d{2}$/;
const TODOS_IGUAIS = /^(.)\1+$/;

/** Módulo 11 com pesos de 2 a `pesoMaximo`, da direita para a esquerda, recomeçando em 2. */
function digitoModulo11(valores: readonly number[], pesoMaximo: number): number {
  const soma = valores.reduce(
    (total, valor, indice) =>
      total + valor * (2 + ((valores.length - 1 - indice) % (pesoMaximo - 1))),
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function digitosVerificadoresConferem(valores: readonly number[], pesoMaximo: number): boolean {
  const corpo = valores.slice(0, -2);
  const primeiro = digitoModulo11(corpo, pesoMaximo);
  const segundo = digitoModulo11([...corpo, primeiro], pesoMaximo);
  return valores.at(-2) === primeiro && valores.at(-1) === segundo;
}

export function validarCpf(valor: string): boolean {
  const texto = valor.trim();
  if (!FORMATO_CPF.test(texto)) {
    return false;
  }
  const digitos = somenteDigitos(texto);
  return !TODOS_IGUAIS.test(digitos) && digitosVerificadoresConferem([...digitos].map(Number), 11);
}

/** Aceita o CNPJ numérico e o alfanumérico, com ou sem pontuação. */
export function validarCnpj(valor: string): boolean {
  const texto = valor.trim().toUpperCase();
  if (!FORMATO_CNPJ.test(texto)) {
    return false;
  }
  const caracteres = texto.replace(/[./-]/g, '');
  // Cada caractere vale o código ASCII menos 48: '0' a '9' valem 0 a 9 e 'A' vale 17.
  const valores = [...caracteres].map((caractere) => caractere.charCodeAt(0) - 48);
  return !TODOS_IGUAIS.test(caracteres) && digitosVerificadoresConferem(valores, 9);
}
