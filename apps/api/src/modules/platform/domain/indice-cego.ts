/** Campos pesquisáveis por igualdade mesmo cifrados (ADR-015). */
export type TipoDeIndice = 'cpf' | 'email' | 'telefone';

const SO_DIGITOS = /\D/g;
const ESPACOS = /\s/g;

/**
 * Forma canônica do valor antes do HMAC: CPF e telefone só com dígitos, e-mail minúsculo e sem
 * espaços. `123.456.789-09` e `12345678909` viram o mesmo índice.
 */
export function normalizarParaIndice(tipo: TipoDeIndice, valor: string): string {
  return tipo === 'email'
    ? valor.replace(ESPACOS, '').toLowerCase()
    : valor.replace(SO_DIGITOS, '');
}
