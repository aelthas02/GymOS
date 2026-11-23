import { RelogioFixo } from './relogio';

describe('RelogioFixo', () => {
  it('agora devolve sempre o instante configurado', () => {
    const relogio = new RelogioFixo('2026-03-10T12:00:00Z');

    expect(relogio.agora().toISOString()).toBe('2026-03-10T12:00:00.000Z');
    expect(relogio.agora().toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });

  it('agora devolve cópia: mutar o resultado não altera o relógio', () => {
    const relogio = new RelogioFixo('2026-03-10T12:00:00Z');

    relogio.agora().setUTCFullYear(1999);

    expect(relogio.agora().toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });

  it('não é afetado por mutação da Date passada ao construtor', () => {
    const original = new Date('2026-03-10T12:00:00Z');
    const relogio = new RelogioFixo(original);

    original.setUTCFullYear(1999);

    expect(relogio.agora().toISOString()).toBe('2026-03-10T12:00:00.000Z');
  });

  it('hojeEm vira o dia em America/Sao_Paulo à meia-noite local (03:00Z)', () => {
    const relogio = new RelogioFixo('2026-03-10T02:59:59Z');

    expect(relogio.hojeEm('America/Sao_Paulo')).toBe('2026-03-09');
    relogio.avancar(1000);
    expect(relogio.hojeEm('America/Sao_Paulo')).toBe('2026-03-10');
  });

  it('definir troca o instante', () => {
    const relogio = new RelogioFixo('2026-03-10T12:00:00Z');

    relogio.definir('2027-01-01T02:00:00Z');

    expect(relogio.hojeEm('America/Sao_Paulo')).toBe('2026-12-31');
    expect(relogio.hojeEm('UTC')).toBe('2027-01-01');
  });

  it('avancar aceita valores negativos', () => {
    const relogio = new RelogioFixo('2026-03-10T03:00:00Z');

    relogio.avancar(-1);

    expect(relogio.hojeEm('America/Sao_Paulo')).toBe('2026-03-09');
  });
});
