import { validarMaximo, validarMinimo, validarSenhaForte } from './valores';

describe('validarMinimo e validarMaximo', () => {
  it('os limites são inclusivos', () => {
    expect(validarMinimo(1000, 1000)).toBe(true);
    expect(validarMinimo(999, 1000)).toBe(false);
    expect(validarMaximo(1000, 1000)).toBe(true);
    expect(validarMaximo(1001, 1000)).toBe(false);
  });

  it('NaN nunca está dentro do limite', () => {
    expect(validarMinimo(Number.NaN, 0)).toBe(false);
    expect(validarMaximo(Number.NaN, 0)).toBe(false);
  });
});

describe('validarSenhaForte', () => {
  it.each(['gymos2026', 'Senh@123', 'ação2026', 'abc 1234'])('%j é forte', (senha) => {
    expect(validarSenhaForte(senha)).toBe(true);
  });

  it.each([
    ['abcdefgh', 'sem número'],
    ['12345678', 'sem letra'],
    ['abc1234', 'sete caracteres'],
    ['', 'vazia'],
  ])('%j é fraca (%s)', (senha) => {
    expect(validarSenhaForte(senha)).toBe(false);
  });
});
