/** '123.456.789-09' → '12345678909'. O valor cru que o modelo guarda. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}
