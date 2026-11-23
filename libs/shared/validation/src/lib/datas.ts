/** Data do calendário (`yyyy-MM-dd` ou `dd/MM/yyyy`), data e hora ISO 8601 ou `Date`. */
export type EntradaDeData = string | Date;

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATA_E_HORA_ISO = /^\d{4}-\d{2}-\d{2}T/;
const COMPETENCIA = /^(0[1-9]|1[0-2])\/(19|20)\d{2}$/;

/** Meia-noite UTC do dia, ou null se o dia não existir (30/02). */
function diaDoCalendario(ano: number, mes: number, dia: number): number | null {
  const instante = Date.UTC(ano, mes - 1, dia);
  const data = new Date(instante);
  const existe =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
  return existe ? instante : null;
}

function paraInstante(valor: EntradaDeData): number | null {
  if (valor instanceof Date) {
    const instante = valor.getTime();
    return Number.isNaN(instante) ? null : instante;
  }
  const texto = valor.trim();
  const iso = DATA_ISO.exec(texto);
  if (iso) {
    return diaDoCalendario(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const br = DATA_BR.exec(texto);
  if (br) {
    return diaDoCalendario(Number(br[3]), Number(br[2]), Number(br[1]));
  }
  // Só ISO 8601: o Date.parse aceita formatos soltos ("March 7") que não queremos.
  const instante = DATA_E_HORA_ISO.test(texto) ? Date.parse(texto) : Number.NaN;
  return Number.isNaN(instante) ? null : instante;
}

export function validarData(valor: EntradaDeData): boolean {
  return paraInstante(valor) !== null;
}

/** Fim igual ou depois do início; com `permitirIgual: false`, estritamente depois. */
export function validarIntervaloDeDatas(
  inicio: EntradaDeData,
  fim: EntradaDeData,
  { permitirIgual = true }: { permitirIgual?: boolean } = {},
): boolean {
  const de = paraInstante(inicio);
  const ate = paraInstante(fim);
  if (de === null || ate === null) {
    return false;
  }
  return permitirIgual ? de <= ate : de < ate;
}

/** Competência fiscal `MM/yyyy` (11/2026). */
export function validarCompetencia(valor: string): boolean {
  return COMPETENCIA.test(valor.trim());
}
