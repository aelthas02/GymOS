import { validarCompetencia, validarData, validarIntervaloDeDatas } from './datas';

describe('validarData', () => {
  it.each(['2026-11-19', '19/11/2026', '2028-02-29', '29/02/2028', '2026-11-19T02:30:00Z'])(
    '%j é data válida',
    (data) => {
      expect(validarData(data)).toBe(true);
    },
  );

  it.each([
    '2026-02-29',
    '30/02/2026',
    '2026-13-01',
    '00/11/2026',
    '19/11/26',
    '2026-11-19T25:00:00Z',
    'amanhã',
    '',
  ])('%j não é data válida', (data) => {
    expect(validarData(data)).toBe(false);
  });

  it('aceita Date válida e recusa Date inválida', () => {
    expect(validarData(new Date('2026-11-19T12:00:00Z'))).toBe(true);
    expect(validarData(new Date('x'))).toBe(false);
  });
});

describe('validarIntervaloDeDatas', () => {
  it('o fim depois do início é coerente', () => {
    expect(validarIntervaloDeDatas('2026-11-01', '2026-11-30')).toBe(true);
    expect(validarIntervaloDeDatas('01/11/2026', '30/11/2026')).toBe(true);
  });

  it('o fim antes do início é incoerente', () => {
    expect(validarIntervaloDeDatas('2026-11-30', '2026-11-01')).toBe(false);
    expect(validarIntervaloDeDatas('30/11/2026', '2026-11-01')).toBe(false);
  });

  it('o mesmo dia é coerente, a menos que se peça fim estritamente depois', () => {
    expect(validarIntervaloDeDatas('2026-11-19', '2026-11-19')).toBe(true);
    expect(validarIntervaloDeDatas('2026-11-19', '2026-11-19', { permitirIgual: false })).toBe(
      false,
    );
    expect(validarIntervaloDeDatas('2026-11-19', '2026-11-20', { permitirIgual: false })).toBe(
      true,
    );
  });

  it('compara instantes quando recebe data e hora', () => {
    const inicio = new Date('2026-11-19T10:00:00Z');

    expect(validarIntervaloDeDatas(inicio, new Date('2026-11-19T09:00:00Z'))).toBe(false);
    expect(validarIntervaloDeDatas(inicio, '2026-11-19T10:30:00Z')).toBe(true);
  });

  it('data inválida em qualquer ponta torna o intervalo incoerente', () => {
    expect(validarIntervaloDeDatas('2026-02-30', '2026-03-01')).toBe(false);
    expect(validarIntervaloDeDatas('2026-03-01', '')).toBe(false);
  });
});

describe('validarCompetencia', () => {
  it.each(['11/2026', '01/2000', '12/1999'])('%j é competência MM/yyyy', (competencia) => {
    expect(validarCompetencia(competencia)).toBe(true);
  });

  it.each(['13/2026', '00/2026', '1/2026', '11/26', '11-2026', '11/1899', '2026-11', ''])(
    '%j não é competência',
    (competencia) => {
      expect(validarCompetencia(competencia)).toBe(false);
    },
  );
});
