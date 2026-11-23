/** Limite inclusivo. Para dinheiro, compare centavos com centavos. */
export function validarMinimo(valor: number, minimo: number): boolean {
  return valor >= minimo;
}

/** Limite inclusivo. Para dinheiro, compare centavos com centavos. */
export function validarMaximo(valor: number, maximo: number): boolean {
  return valor <= maximo;
}

export const TAMANHO_MINIMO_DA_SENHA = 8;

/** Ao menos 8 caracteres, com pelo menos uma letra e um número. */
export function validarSenhaForte(senha: string): boolean {
  return (
    [...senha].length >= TAMANHO_MINIMO_DA_SENHA && /\p{L}/u.test(senha) && /\p{Nd}/u.test(senha)
  );
}
