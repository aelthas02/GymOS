const BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** `dd/MM/yyyy` (ou já `yyyy-MM-dd`) para `yyyy-MM-dd`; vazio ou inválido vira `null`. */
export function dataParaIso(texto: string | null | undefined): string | null {
  const valor = (texto ?? '').trim();
  const br = BR.exec(valor);
  if (br) {
    return `${br[3]}-${br[2]}-${br[1]}`;
  }
  return ISO.test(valor) ? valor : null;
}

/** `yyyy-MM-dd` para `dd/MM/yyyy`; o que não for data fica como veio. */
export function dataDeIso(iso: string | null | undefined): string {
  if (!iso || !ISO.test(iso)) {
    return iso ?? '';
  }
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** "03/2026" a partir de `yyyy-MM-dd`, como o cabeçalho do Acompanhamento ("desde 03/2026"). */
export function mesEAno(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
