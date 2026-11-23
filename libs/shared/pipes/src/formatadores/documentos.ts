import { somenteDigitos } from '@gymos/shared-validation';

/** '12345678909' → '123.456.789-09'; o que não tiver 11 dígitos volta como veio. */
export function formatarCpf(valor: string): string {
  const digitos = somenteDigitos(valor);
  return digitos.length === 11
    ? digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
    : valor;
}

/** '12345678000195' → '12.345.678/0001-95'; também o alfanumérico, em maiúsculas. */
export function formatarCnpj(valor: string): string {
  const caracteres = valor.replace(/[^\dA-Za-z]/g, '').toUpperCase();
  return caracteres.length === 14
    ? caracteres.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
    : valor;
}

/** '11999990000' → '(11) 99999-0000'; '1133334444' → '(11) 3333-4444'; tira o +55. */
export function formatarTelefone(valor: string): string {
  const digitos = somenteDigitos(valor).replace(/^55(\d{10,11})$/, '$1');
  return digitos.length === 10 || digitos.length === 11
    ? digitos.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
    : valor;
}
