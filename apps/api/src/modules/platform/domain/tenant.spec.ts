import { dataCivilEm } from './relogio';
import { slugDisponivelParaAcademia, slugDoHost } from './tenant';

describe('slugDoHost', () => {
  it.each([
    ['ritmo.gymos.app', 'gymos.app', 'ritmo'],
    ['ritmo.gymos.app:3000', 'gymos.app', 'ritmo'],
    ['RITMO.Gymos.APP', 'gymos.app', 'ritmo'],
    ['ritmo.gymos.app', 'GYMOS.APP', 'ritmo'],
    ['  ritmo.localhost:4200  ', 'localhost', 'ritmo'],
    ['a.localhost', 'localhost', 'a'],
    ['ritmo-2.gymos.app', 'gymos.app', 'ritmo-2'],
  ])('%s com base %s → %s', (host, base, esperado) => {
    expect(slugDoHost(host, base)).toBe(esperado);
  });

  it.each([
    [undefined, 'gymos.app'],
    ['', 'gymos.app'],
    ['gymos.app', 'gymos.app'],
    ['.gymos.app', 'gymos.app'],
    ['localhost:3000', 'localhost'],
    ['ritmo.outro.app', 'gymos.app'],
    ['ritmo.gymos.app.evil.com', 'gymos.app'],
    ['evilgymos.app', 'gymos.app'],
    ['a.b.gymos.app', 'gymos.app'],
    ['-ritmo.gymos.app', 'gymos.app'],
    ['ritmo-.gymos.app', 'gymos.app'],
    ['ri_tmo.gymos.app', 'gymos.app'],
    ['ritmo.gymos.app:abc', 'gymos.app'],
    ['ritmo.localhost', 'gymos.app'],
  ])('%j com base %s → null', (host, base) => {
    expect(slugDoHost(host, base)).toBeNull();
  });

  it('aceita slug de até 40 caracteres e rejeita 41', () => {
    expect(slugDoHost(`${'a'.repeat(40)}.gymos.app`, 'gymos.app')).toBe('a'.repeat(40));
    expect(slugDoHost(`${'a'.repeat(41)}.gymos.app`, 'gymos.app')).toBeNull();
  });
});

describe('slugDisponivelParaAcademia', () => {
  it.each(['api', 'www', 'admin'])('%s é reservado', (slug) => {
    expect(slugDisponivelParaAcademia(slug)).toBe(false);
  });

  it.each(['ritmo', 'api2', 'a'])('%s está disponível', (slug) => {
    expect(slugDisponivelParaAcademia(slug)).toBe(true);
  });
});

describe('dataCivilEm', () => {
  const SP = 'America/Sao_Paulo';

  it.each([
    ['2026-03-10T02:59:59Z', '2026-03-09'],
    ['2026-03-10T03:00:00Z', '2026-03-10'],
    ['2026-03-10T02:59:59.999Z', '2026-03-09'],
    ['2026-01-01T02:59:59Z', '2025-12-31'],
    ['2026-01-01T03:00:00Z', '2026-01-01'],
    ['2026-12-31T23:59:59Z', '2026-12-31'],
    ['2028-03-01T02:59:59Z', '2028-02-29'],
  ])('%s em São Paulo → %s', (instante, esperado) => {
    expect(dataCivilEm(new Date(instante), SP)).toBe(esperado);
  });

  it('o mesmo instante cai em dias diferentes em UTC e em São Paulo', () => {
    const instante = new Date('2026-03-10T02:59:59Z');

    expect(dataCivilEm(instante, 'UTC')).toBe('2026-03-10');
    expect(dataCivilEm(instante, SP)).toBe('2026-03-09');
  });

  it('respeita fusos à frente de UTC', () => {
    expect(dataCivilEm(new Date('2026-03-09T20:00:00Z'), 'Asia/Tokyo')).toBe('2026-03-10');
  });

  it('lança erro para fuso inválido', () => {
    expect(() => dataCivilEm(new Date(0), 'Marte/Olympus')).toThrow(RangeError);
  });
});
