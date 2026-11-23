import { centavosDeBigInt, type Centavos, type PontosBase } from './centavos';
import { dividirMeioParaCima } from './divisao';

const PONTOS_BASE_EM_100_PORCENTO = 10_000n;

/**
 * Aplica uma alíquota ou percentual em pontos-base sobre um valor em centavos, em conta inteira,
 * arredondando o meio para longe do zero: 2,5% de R$ 119,00 = R$ 2,98; de −R$ 119,00 = −R$ 2,98.
 */
export function aplicarAliquota(valor: Centavos, aliquota: PontosBase): Centavos {
  return centavosDeBigInt(
    dividirMeioParaCima(BigInt(valor) * BigInt(aliquota), PONTOS_BASE_EM_100_PORCENTO),
  );
}
