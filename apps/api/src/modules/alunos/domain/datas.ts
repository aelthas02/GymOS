import type { DataCivil } from '../../platform/domain/relogio';

// Contas de calendário do contrato. Um dia é `DataCivil` (AAAA-MM-DD), sem hora nem fuso: somar dias
// e meses não depende de horário de verão.

const UM_DIA_MS = 24 * 60 * 60 * 1000;

function partes(dia: DataCivil): [number, number, number] {
  const [ano = 0, mes = 0, d = 0] = dia.split('-').map(Number);
  return [ano, mes, d];
}

function deUtc(instante: number): DataCivil {
  return new Date(instante).toISOString().slice(0, 10) as DataCivil;
}

function emUtc(dia: DataCivil): number {
  const [ano, mes, d] = partes(dia);
  return Date.UTC(ano, mes - 1, d);
}

export function ehDataCivil(valor: string): valor is DataCivil {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && deUtc(Date.parse(`${valor}T00:00:00Z`)) === valor;
}

export function somarDias(dia: DataCivil, dias: number): DataCivil {
  return deUtc(emUtc(dia) + dias * UM_DIA_MS);
}

/** Dias corridos de `de` até `ate` (negativo quando `ate` vem antes). */
export function diasEntre(de: DataCivil, ate: DataCivil): number {
  return Math.round((emUtc(ate) - emUtc(de)) / UM_DIA_MS);
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Último dia da vigência de um contrato de `meses` iniciado em `inicio`: o dia anterior ao mesmo dia
 * N meses depois (19/11/2026 + 12 → 18/11/2027). Se esse dia não existe no mês final, a vigência vai
 * até o último dia do mês (31/01 + 1 → 28/02, ou 29/02 em ano bissexto).
 */
export function fimDaVigencia(inicio: DataCivil, meses: number): DataCivil {
  const [ano, mes, dia] = partes(inicio);
  const indice = mes - 1 + meses;
  const anoFinal = ano + Math.floor(indice / 12);
  const mesFinal = (indice % 12) + 1;
  const ultimo = ultimoDiaDoMes(anoFinal, mesFinal);
  if (dia > ultimo) {
    return deUtc(Date.UTC(anoFinal, mesFinal - 1, ultimo));
  }
  return somarDias(deUtc(Date.UTC(anoFinal, mesFinal - 1, dia)), -1);
}

/** Deslocamento do fuso em minutos num instante (São Paulo: −180). */
function deslocamentoEm(instante: number, fuso: string): number {
  const texto = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(instante);
  const [data = '', hora = ''] = texto.split(', ');
  const [mes = 0, dia = 0, ano = 0] = data.split('/').map(Number);
  const [h = 0, m = 0, s = 0] = hora.split(':').map(Number);
  return (Date.UTC(ano, mes - 1, dia, h, m, s) - instante) / 60_000;
}

/** 23:59:59 do dia no fuso (fim da vigência de 18/11/2027 em São Paulo → 2027-11-19T02:59:59Z). */
export function fimDoDiaEm(dia: DataCivil, fuso: string): Date {
  const [ano, mes, d] = partes(dia);
  const local = Date.UTC(ano, mes - 1, d, 23, 59, 59);
  const aproximado = local - deslocamentoEm(local, fuso) * 60_000;
  return new Date(local - deslocamentoEm(aproximado, fuso) * 60_000);
}

/** `Date` do Prisma para coluna `@db.Date` (meia-noite UTC) ↔ dia do calendário. */
export function paraColunaDeData(dia: DataCivil): Date {
  return new Date(emUtc(dia));
}

export function daColunaDeData(data: Date): DataCivil {
  return deUtc(data.getTime());
}
