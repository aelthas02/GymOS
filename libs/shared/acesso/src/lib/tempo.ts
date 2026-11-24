// Calendário de São Paulo para as regras de acesso. Puro e sem relógio: quem chama passa o instante.
// O agente da catraca (T24a) usa o mesmo cálculo offline, então o fuso é fixo (como no domínio de
// alunos, o tenant não tem fuso próprio).

export const FUSO_DO_ACESSO = 'America/Sao_Paulo';

/** Dia do calendário (`yyyy-MM-dd`). */
export type Dia = string;

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_DO_ACESSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function partesEmSaoPaulo(instante: Date): Record<string, string> {
  const partes: Record<string, string> = {};
  for (const parte of formato.formatToParts(instante)) {
    partes[parte.type] = parte.value;
  }
  return partes;
}

/** Dia do calendário de São Paulo em que o instante cai. */
export function diaEmSaoPaulo(instante: Date): Dia {
  const p = partesEmSaoPaulo(instante);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

/** Minutos desde a meia-noite de São Paulo (0 a 1439). */
export function minutoDoDiaEmSaoPaulo(instante: Date): number {
  const p = partesEmSaoPaulo(instante);
  return Number(p['hour']) * 60 + Number(p['minute']);
}

/** `HH:MM` em minutos desde a meia-noite; texto fora do formato lança erro. */
export function minutosDoHorario(horario: string): number {
  const achado = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(horario);
  if (!achado) {
    throw new RangeError(`Horário inválido: ${horario}. Use HH:MM.`);
  }
  return Number(achado[1]) * 60 + Number(achado[2]);
}

const MS_POR_DIA = 86_400_000;

function utcDoDia(dia: Dia): number {
  const [ano = 0, mes = 1, d = 1] = dia.split('-').map(Number);
  return Date.UTC(ano, mes - 1, d);
}

function paraDia(utc: number): Dia {
  return new Date(utc).toISOString().slice(0, 10);
}

export function somarDiasAoDia(dia: Dia, dias: number): Dia {
  return paraDia(utcDoDia(dia) + dias * MS_POR_DIA);
}

/** Segunda-feira da semana do dia (a semana do plano vai de segunda a domingo). */
export function segundaDaSemana(dia: Dia): Dia {
  const diaDaSemana = new Date(utcDoDia(dia)).getUTCDay(); // 0 = domingo
  return somarDiasAoDia(dia, -((diaDaSemana + 6) % 7));
}
