import { formatarDataBr, formatarTempoRelativo } from './datas';

const SEG = 1000;
const MIN = 60 * SEG;
const HORA = 60 * MIN;
const AGORA = Date.parse('2026-11-19T12:00:00-03:00');
const atras = (ms: number): number => AGORA - ms;

describe('formatarTempoRelativo nas fronteiras exatas', () => {
  it.each([
    [0, 'agora', 'agora'],
    [59 * SEG, 'agora', 'agora'],
    [59 * SEG + 999, 'agora', 'agora'],
    [60 * SEG, 'há 1 min', 'há 1 minuto'],
    [2 * MIN, 'há 2 min', 'há 2 minutos'],
    [59 * MIN + 59 * SEG, 'há 59 min', 'há 59 minutos'],
    [59 * MIN + 59 * SEG + 999, 'há 59 min', 'há 59 minutos'],
    [60 * MIN, 'há 1h', 'há 1 hora'],
    [61 * MIN, 'há 1h', 'há 1 hora'],
    [119 * MIN, 'há 1h', 'há 1 hora'],
    [120 * MIN, 'há 2h', 'há 2 horas'],
    [47 * HORA + 59 * MIN, 'há 47h', 'há 47 horas'],
    [48 * HORA - 1, 'há 47h', 'há 47 horas'],
    [48 * HORA, 'há 2 dias', 'há 2 dias'],
  ])('há %i ms → %s / %s', (decorrido, curta, longa) => {
    expect(formatarTempoRelativo(atras(decorrido), 'curta', AGORA)).toBe(curta);
    expect(formatarTempoRelativo(atras(decorrido), 'longa', AGORA)).toBe(longa);
  });

  it('a partir de 48 h conta dias de calendário, não blocos de 24 h', () => {
    expect(
      formatarTempoRelativo('2026-11-10T23:59:00-03:00', 'curta', '2026-11-12T23:59:00-03:00'),
    ).toBe('há 2 dias');
    expect(
      formatarTempoRelativo('2026-11-11T00:01:00-03:00', 'curta', '2026-11-13T00:00:00-03:00'),
    ).toBe('há 47h');
  });

  it('instante no futuro cai em "agora"', () => {
    expect(formatarTempoRelativo(AGORA + HORA, 'curta', AGORA)).toBe('agora');
  });
});

describe('formatarTempoRelativo na variante lista, na virada de ano', () => {
  it.each([
    ['2025-12-31T23:59:00-03:00', '2026-01-01T00:01:00-03:00', 'Ontem'],
    ['2026-01-01T00:00:00-03:00', '2026-01-01T23:59:00-03:00', 'Hoje'],
    ['2025-12-31T10:00:00-03:00', '2026-01-03T10:00:00-03:00', 'Qua'],
    ['2025-12-26T10:00:00-03:00', '2026-01-01T10:00:00-03:00', 'Sex'],
    ['2025-12-25T10:00:00-03:00', '2026-01-01T10:00:00-03:00', '25/12/2025'],
    ['2026-01-02T10:00:00-03:00', '2026-12-30T10:00:00-03:00', '02/01'],
    ['2025-12-31T10:00:00-03:00', '2026-12-31T10:00:00-03:00', '31/12/2025'],
  ])('%s visto em %s → %s', (valor, agora, esperado) => {
    expect(formatarTempoRelativo(valor, 'lista', agora)).toBe(esperado);
  });

  it('usa o dia de São Paulo, não o de UTC: 02:00Z ainda é o dia anterior', () => {
    expect(
      formatarTempoRelativo('2026-01-01T02:00:00Z', 'lista', '2025-12-31T23:00:00-03:00'),
    ).toBe('Hoje');
  });

  it('a virada do horário de verão não muda a conta de dias (03/11 → 04/11/2018)', () => {
    expect(
      formatarTempoRelativo('2018-11-03T23:30:00-03:00', 'lista', '2018-11-04T12:00:00-02:00'),
    ).toBe('Ontem');
  });
});

describe('formatarDataBr com o horário de verão histórico de São Paulo', () => {
  it('início: a meia-noite de 04/11/2018 não existiu, o relógio saltou para 01:00', () => {
    expect(formatarDataBr('2018-11-04T02:59:59Z', 'dataHora')).toBe('03/11/2018 23:59');
    expect(formatarDataBr('2018-11-04T03:00:00Z', 'dataHora')).toBe('04/11/2018 01:00');
  });

  it('fim: 23:30 de 16/02/2019 acontece duas vezes, e 17/02 começa às 03:00Z', () => {
    expect(formatarDataBr('2019-02-17T01:30:00Z', 'dataHora')).toBe('16/02/2019 23:30');
    expect(formatarDataBr('2019-02-17T02:30:00Z', 'dataHora')).toBe('16/02/2019 23:30');
    expect(formatarDataBr('2019-02-17T03:00:00Z', 'dataHora')).toBe('17/02/2019 00:00');
  });

  it.each(['2018-11-03', '2018-11-04', '2018-11-05', '2019-02-16', '2019-02-17', '2019-02-18'])(
    'data sem hora %s não muda de dia',
    (data) => {
      const [ano, mes, dia] = data.split('-');

      expect(formatarDataBr(data)).toBe(`${dia}/${mes}/${ano}`);
    },
  );

  it('todo dia de 2016 a 2021 sem hora volta igual (inclui os dois verões e as viradas de ano)', () => {
    for (
      let instante = Date.UTC(2016, 0, 1);
      instante < Date.UTC(2022, 0, 1);
      instante += 86_400_000
    ) {
      const [ano, mes, dia] = new Date(instante).toISOString().slice(0, 10).split('-');

      expect(formatarDataBr(`${ano}-${mes}-${dia}`)).toBe(`${dia}/${mes}/${ano}`);
    }
  });

  it('no verão o fuso é −02: 2018-12-25T01:00Z é 24/12 23:00', () => {
    expect(formatarDataBr('2018-12-25T01:00:00Z', 'dataHora')).toBe('24/12/2018 23:00');
  });
});
