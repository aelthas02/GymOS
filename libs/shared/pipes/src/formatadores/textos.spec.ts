import { iniciais, rotuloDeStatus } from './textos';

describe('iniciais', () => {
  it.each([
    ['Rafael Souza', 'RS'],
    ['Maria da Silva Santos', 'MS'],
    ['juliana', 'J'],
    ['  Érica   de Ávila ', 'ÉA'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });
});

describe('rotuloDeStatus', () => {
  it('late conta os dias de atraso com singular e plural', () => {
    expect(rotuloDeStatus('late', 6)).toBe('Em atraso, 6 dias');
    expect(rotuloDeStatus('late', 1)).toBe('Em atraso, 1 dia');
  });

  it('soon diz quando vence', () => {
    expect(rotuloDeStatus('soon', 0)).toBe('Vence hoje');
    expect(rotuloDeStatus('soon', 1)).toBe('Vence amanhã');
    expect(rotuloDeStatus('soon', 3)).toBe('Vence em 3 dias');
  });

  it('ok e off não dependem de dias', () => {
    expect(rotuloDeStatus('ok')).toBe('Em dia');
    expect(rotuloDeStatus('off')).toBe('Inativo');
  });

  it('sem os dias, late e soon têm rótulo curto', () => {
    expect(rotuloDeStatus('late')).toBe('Em atraso');
    expect(rotuloDeStatus('soon', null)).toBe('A vencer');
  });
});
