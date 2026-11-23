// Divisões inteiras com arredondamento explícito. O divisor é sempre positivo; o sinal vem do
// dividendo e o arredondamento é simétrico (o que vale para 2,975 vale para −2,975).

function dividirSimetrico(
  dividendo: bigint,
  divisor: bigint,
  sobeNoMeio: (quociente: bigint) => boolean,
): bigint {
  const absoluto = dividendo < 0n ? -dividendo : dividendo;
  const quociente = absoluto / divisor;
  const dobroDoResto = (absoluto % divisor) * 2n;
  const sobe = dobroDoResto > divisor || (dobroDoResto === divisor && sobeNoMeio(quociente));
  const arredondado = sobe ? quociente + 1n : quociente;
  return dividendo < 0n ? -arredondado : arredondado;
}

/** Meio para longe do zero: 2,975 → 2,98 e −2,975 → −2,98 (regra do dinheiro). */
export function dividirMeioParaCima(dividendo: bigint, divisor: bigint): bigint {
  return dividirSimetrico(dividendo, divisor, () => true);
}

/** Meio para o par: 3,85 → 3,8 e 3,75 → 3,8. Usado só na exibição de percentuais já arredondados. */
export function dividirMeioParaPar(dividendo: bigint, divisor: bigint): bigint {
  return dividirSimetrico(dividendo, divisor, (quociente) => quociente % 2n === 1n);
}
