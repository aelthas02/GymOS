/**
 * Aplica um gabarito a caracteres já filtrados: `#` consome um caractere e o resto é literal,
 * inserido só quando ainda há caractere para depois dele ('123' → '123'; '1234' → '123.4').
 */
export function aplicarGabarito(caracteres: string, gabarito: string): string {
  let saida = '';
  let indice = 0;
  for (const simbolo of gabarito) {
    if (indice >= caracteres.length) {
      break;
    }
    if (simbolo === '#') {
      saida += caracteres[indice++];
    } else {
      saida += simbolo;
    }
  }
  return saida;
}

export const apenasDigitos = (texto: string): string => texto.replace(/\D/g, '');
