export const FUSO_DE_SAO_PAULO = 'America/Sao_Paulo';

/** Data e hora ISO 8601, data `yyyy-MM-dd` (dia do calendário), milissegundos ou `Date`. */
export type EntradaDeInstante = string | number | Date;

export type FormatoDeData = 'data' | 'dataHora' | 'hora';

/**
 * `curta`: "há 2 min", "há 2h"; `longa`: "há 1 minuto", "há 26 horas"; `lista`: "Hoje", "Ontem",
 * dia da semana até 6 dias e depois `dd/MM` (`dd/MM/yyyy` se for de outro ano).
 */
export type VarianteDeTempoRelativo = 'curta' | 'longa' | 'lista';

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const LIMITE_EM_HORAS = 48 * HORA;
const DIAS_DA_SEMANA = 'DomSegTerQuaQuiSexSáb';

const PARTES_EM_SAO_PAULO = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO_DE_SAO_PAULO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface DataEmSaoPaulo {
  ano: string;
  mes: string;
  dia: string;
  hora: string;
  minuto: string;
  /** Dias desde 01/01/1970 no calendário de São Paulo: a diferença entre dois é a de calendário. */
  diaCorrido: number;
}

function paraInstante(valor: EntradaDeInstante): number | null {
  let instante: number;
  if (valor instanceof Date) {
    instante = valor.getTime();
  } else if (typeof valor === 'number') {
    instante = valor;
  } else {
    // Data sem hora é dia do calendário: meia-noite em São Paulo (UTC−3 desde 2019; nos anos com
    // horário de verão, meia-noite em −3 cai no mesmo dia), para o fuso não trocar o dia.
    instante = Date.parse(SO_DATA.test(valor) ? `${valor}T00:00:00-03:00` : valor);
  }
  return Number.isFinite(instante) ? instante : null;
}

function emSaoPaulo(instante: number): DataEmSaoPaulo {
  const partes = Object.fromEntries(
    PARTES_EM_SAO_PAULO.formatToParts(instante).map((parte) => [parte.type, parte.value]),
  );
  const {
    year: ano = '',
    month: mes = '',
    day: dia = '',
    hour: hora = '',
    minute: minuto = '',
  } = partes;
  return {
    ano,
    mes,
    dia,
    hora,
    minuto,
    diaCorrido: Date.UTC(Number(ano), Number(mes) - 1, Number(dia)) / DIA,
  };
}

/** '2026-11-19T02:30:00Z' → '18/11/2026' (São Paulo). Data inválida vira ''. */
export function formatarDataBr(valor: EntradaDeInstante, formato: FormatoDeData = 'data'): string {
  const instante = paraInstante(valor);
  if (instante === null) {
    return '';
  }
  const { ano, mes, dia, hora, minuto } = emSaoPaulo(instante);
  const data = `${dia}/${mes}/${ano}`;
  const horario = `${hora}:${minuto}`;
  if (formato === 'hora') {
    return horario;
  }
  return formato === 'dataHora' ? `${data} ${horario}` : data;
}

function rotuloDeLista(de: DataEmSaoPaulo, ate: DataEmSaoPaulo): string {
  const dias = ate.diaCorrido - de.diaCorrido;
  if (dias === 0) {
    return 'Hoje';
  }
  if (dias === 1) {
    return 'Ontem';
  }
  if (dias >= 2 && dias <= 6) {
    // 01/01/1970 foi uma quinta-feira (índice 4 a partir de domingo).
    const indice = (de.diaCorrido + 4) % 7;
    return DIAS_DA_SEMANA.slice(indice * 3, indice * 3 + 3);
  }
  return de.ano === ate.ano ? `${de.dia}/${de.mes}` : `${de.dia}/${de.mes}/${de.ano}`;
}

/**
 * Tempo decorrido entre `valor` e `agora`, que vem do relógio do chamador (pipe puro). Minutos até
 * 1 hora, horas até 48 horas e, daí em diante, dias do calendário de São Paulo.
 */
export function formatarTempoRelativo(
  valor: EntradaDeInstante,
  variante: VarianteDeTempoRelativo,
  agora: EntradaDeInstante,
): string {
  const de = paraInstante(valor);
  const ate = paraInstante(agora);
  if (de === null || ate === null) {
    return '';
  }
  if (variante === 'lista') {
    return rotuloDeLista(emSaoPaulo(de), emSaoPaulo(ate));
  }
  const decorrido = ate - de;
  const longa = variante === 'longa';
  if (decorrido < MINUTO) {
    return 'agora';
  }
  if (decorrido < HORA) {
    const minutos = Math.floor(decorrido / MINUTO);
    if (!longa) {
      return `há ${minutos} min`;
    }
    return `há ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
  }
  if (decorrido < LIMITE_EM_HORAS) {
    const horas = Math.floor(decorrido / HORA);
    if (!longa) {
      return `há ${horas}h`;
    }
    return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }
  return `há ${emSaoPaulo(ate).diaCorrido - emSaoPaulo(de).diaCorrido} dias`;
}
