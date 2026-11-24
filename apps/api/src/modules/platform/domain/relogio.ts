declare const marcaDeDataCivil: unique symbol;

/** Data de calendário (AAAA-MM-DD) num fuso, sem hora. */
export type DataCivil = string & { readonly [marcaDeDataCivil]: true };

export const FUSO_PADRAO = 'America/Sao_Paulo';

/**
 * Porta do tempo. O domínio e os casos de uso nunca chamam `Date.now()` nem `new Date()` sem
 * argumento (o lint proíbe): recebem um Relogio. Em teste, `RelogioFixo`; em dev e teste, o
 * cabeçalho `x-relogio` fixa o instante da requisição.
 */
export abstract class Relogio {
  /** Instante atual (UTC). */
  abstract agora(): Date;

  /** Data de hoje no fuso informado, por exemplo `hojeEm('America/Sao_Paulo')`. */
  hojeEm(fusoHorario: string): DataCivil {
    return dataCivilEm(this.agora(), fusoHorario);
  }
}

export function dataCivilEm(instante: Date, fusoHorario: string): DataCivil {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const parte = (tipo: Intl.DateTimeFormatPartTypes): string =>
    (partes.find((item) => item.type === tipo) as Intl.DateTimeFormatPart).value;
  return `${parte('year')}-${parte('month')}-${parte('day')}` as DataCivil;
}
