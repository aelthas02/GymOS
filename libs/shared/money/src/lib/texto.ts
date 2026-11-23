import { centavos, type Centavos, type PontosBase } from './centavos';
import { dividirMeioParaPar } from './divisao';

const MAIOR_INTEIRO_SEGURO = BigInt(Number.MAX_SAFE_INTEGER);

// "-R$ 2,98", "R$ -2,98", "R$ 1.234,56", "1234,5" e "119" (reais inteiros).
const PADRAO_BRL = /^(-)?(?:R\$)?\s*(-)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

function agruparMilhares(digitos: string): string {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Separa os dígitos de um inteiro não negativo em parte inteira e `casas` decimais. */
function separarCasas(absoluto: bigint, casas: number): { inteira: string; decimais: string } {
  const digitos = absoluto.toString().padStart(casas + 1, '0');
  const corte = digitos.length - casas;
  return { inteira: digitos.slice(0, corte), decimais: digitos.slice(corte) };
}

/** 4832000 → "R$ 48.320,00"; −298 → "-R$ 2,98". Conta só com dígitos, sem ponto flutuante. */
export function formatarBrl(valor: Centavos): string {
  const inteiro = BigInt(centavos(valor));
  const { inteira, decimais } = separarCasas(inteiro < 0n ? -inteiro : inteiro, 2);
  return `${inteiro < 0n ? '-' : ''}R$ ${agruparMilhares(inteira)},${decimais}`;
}

/**
 * Lê um valor em reais digitado ou colado ("R$ 1.234,56", "-R$ 2,98", "119") e devolve os centavos,
 * ou `null` se o texto não for um valor em reais. Sem vírgula, o número é de reais inteiros.
 */
export function interpretarBrl(texto: string): Centavos | null {
  const partes = PADRAO_BRL.exec(texto.trim());
  if (!partes || (partes[1] && partes[2])) {
    return null;
  }
  const [, sinalAntes, sinalDepois, reais = '', decimais = ''] = partes;
  const absoluto = BigInt(reais.replaceAll('.', '') + decimais.padEnd(2, '0'));
  if (absoluto > MAIOR_INTEIRO_SEGURO) {
    return null;
  }
  return centavos(Number(sinalAntes || sinalDepois ? -absoluto : absoluto));
}

/**
 * 250 → "2,5%"; 4200 → "42%". Mostra até `casas` decimais sem zeros à direita. Ao cortar casas, o
 * meio vai para o par (385 → "3,8%"): o valor em pontos-base já vem arredondado, e arredondar o meio
 * para cima de novo exibiria 3,9% para 12 de 312 (3,846%).
 */
export function formatarPercentual(valor: PontosBase, casas: 0 | 1 | 2 = 1): string {
  const escalado = dividirMeioParaPar(BigInt(valor), 10n ** BigInt(2 - casas));
  const { inteira, decimais } = separarCasas(escalado < 0n ? -escalado : escalado, casas);
  const fracao = decimais.replace(/0+$/, '');
  return `${escalado < 0n ? '-' : ''}${agruparMilhares(inteira)}${fracao ? `,${fracao}` : ''}%`;
}
