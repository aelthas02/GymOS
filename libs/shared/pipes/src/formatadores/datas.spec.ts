import { formatarDataBr, formatarTempoRelativo, type VarianteDeTempoRelativo } from './datas';

describe('formatarDataBr', () => {
  it('2026-11-19T02:30:00Z é 18/11/2026 em São Paulo', () => {
    expect(formatarDataBr('2026-11-19T02:30:00Z')).toBe('18/11/2026');
  });

  it('formata data e hora ou só a hora', () => {
    expect(formatarDataBr('2026-11-19T02:30:00Z', 'dataHora')).toBe('18/11/2026 23:30');
    expect(formatarDataBr('2026-11-19T12:05:00Z', 'hora')).toBe('09:05');
  });

  it('data sem hora é dia do calendário, sem mudar de dia pelo fuso', () => {
    expect(formatarDataBr('2026-11-19')).toBe('19/11/2026');
    expect(formatarDataBr('1990-01-15')).toBe('15/01/1990');
  });

  it('aceita Date e milissegundos', () => {
    const instante = Date.parse('2026-11-19T12:00:00Z');

    expect(formatarDataBr(new Date(instante))).toBe('19/11/2026');
    expect(formatarDataBr(instante, 'dataHora')).toBe('19/11/2026 09:00');
  });

  it('data inválida vira texto vazio', () => {
    expect(formatarDataBr('ontem')).toBe('');
    expect(formatarDataBr(new Date('x'))).toBe('');
    expect(formatarDataBr(Number.NaN)).toBe('');
  });
});

describe('formatarTempoRelativo, com o relógio em 19/11/2026 09:00 de São Paulo', () => {
  const agora = '2026-11-19T09:00:00-03:00';

  it.each([
    ['2026-11-19T08:59:00-03:00', 'há 1 min', 'há 1 minuto', 'Hoje'],
    ['2026-11-19T07:00:00-03:00', 'há 2h', 'há 2 horas', 'Hoje'],
    ['2026-11-18T07:00:00-03:00', 'há 26h', 'há 26 horas', 'Ontem'],
    ['2026-11-16T10:00:00-03:00', 'há 3 dias', 'há 3 dias', 'Seg'],
    ['2026-11-01T10:00:00-03:00', 'há 18 dias', 'há 18 dias', '01/11'],
  ])('%s → %s | %s | %s', (entrada, curta, longa, lista) => {
    const em = (variante: VarianteDeTempoRelativo) =>
      formatarTempoRelativo(entrada, variante, agora);

    expect([em('curta'), em('longa'), em('lista')]).toEqual([curta, longa, lista]);
  });

  it('menos de um minuto, ou um instante no futuro, é "agora"', () => {
    expect(formatarTempoRelativo('2026-11-19T08:59:30-03:00', 'curta', agora)).toBe('agora');
    expect(formatarTempoRelativo('2026-11-19T09:05:00-03:00', 'longa', agora)).toBe('agora');
  });

  it('singular e plural na variante longa', () => {
    expect(formatarTempoRelativo('2026-11-19T08:55:00-03:00', 'longa', agora)).toBe('há 5 minutos');
    expect(formatarTempoRelativo('2026-11-19T07:30:00-03:00', 'longa', agora)).toBe('há 1 hora');
  });

  it('passa de horas para dias em 48 horas, contando dias do calendário', () => {
    expect(formatarTempoRelativo('2026-11-17T09:01:00-03:00', 'curta', agora)).toBe('há 47h');
    expect(formatarTempoRelativo('2026-11-17T08:59:00-03:00', 'curta', agora)).toBe('há 2 dias');
  });

  it('a lista conta o dia pelo calendário de São Paulo, não pelo UTC', () => {
    // 19/11 00:30 em SP ainda é 19/11 03:30 em UTC; 18/11 23:30 em SP já é 19/11 02:30 em UTC.
    expect(formatarTempoRelativo('2026-11-19T00:30:00-03:00', 'lista', agora)).toBe('Hoje');
    expect(formatarTempoRelativo('2026-11-19T02:30:00Z', 'lista', agora)).toBe('Ontem');
  });

  it('a lista mostra o dia da semana até 6 dias e a data a partir de 7', () => {
    expect(formatarTempoRelativo('2026-11-13T10:00:00-03:00', 'lista', agora)).toBe('Sex');
    expect(formatarTempoRelativo('2026-11-12T10:00:00-03:00', 'lista', agora)).toBe('12/11');
  });

  it('a lista mostra o ano quando a data é de outro ano, e a data quando é futura', () => {
    expect(formatarTempoRelativo('2025-12-31T10:00:00-03:00', 'lista', agora)).toBe('31/12/2025');
    expect(formatarTempoRelativo('2026-11-21T10:00:00-03:00', 'lista', agora)).toBe('21/11');
  });

  it('aceita Date e milissegundos para os dois lados', () => {
    const relogio = new Date(Date.parse(agora));

    expect(formatarTempoRelativo(relogio.getTime() - 120_000, 'curta', relogio)).toBe('há 2 min');
  });

  it('data inválida vira texto vazio', () => {
    expect(formatarTempoRelativo('x', 'curta', agora)).toBe('');
    expect(formatarTempoRelativo(agora, 'curta', 'x')).toBe('');
  });
});
