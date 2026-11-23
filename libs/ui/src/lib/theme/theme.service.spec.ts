import { TestBed } from '@angular/core/testing';
import { accentPalette, accentText, InvalidHexColorError } from '../../../styles/contrast';
import { tokens } from '../../../styles/tokens';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const estilo = (): CSSStyleDeclaration => document.documentElement.style;
  const variaveis = (): string[] =>
    ['--accent', '--accent-contrast', '--accent-text'].map((nome) =>
      estilo().getPropertyValue(nome),
    );

  afterEach(() => {
    estilo().removeProperty('--accent');
    estilo().removeProperty('--accent-contrast');
    estilo().removeProperty('--accent-text');
  });

  it('setAccent atualiza --accent, --accent-contrast e --accent-text no documentElement', () => {
    const tema = TestBed.inject(ThemeService);

    tema.setAccent('#22C98A');

    expect(estilo().getPropertyValue('--accent')).toBe('#22C98A');
    expect(estilo().getPropertyValue('--accent-contrast')).toBe('#0C1722');
    expect(estilo().getPropertyValue('--accent-text')).toBe(accentText('#22C98A'));
  });

  it('setAccent com um acento escuro troca o texto sobre o acento para branco', () => {
    const tema = TestBed.inject(ThemeService);

    tema.setAccent('#1E3A8A');

    expect(estilo().getPropertyValue('--accent')).toBe('#1E3A8A');
    expect(estilo().getPropertyValue('--accent-contrast')).toBe('#FFFFFF');
    expect(estilo().getPropertyValue('--accent-text')).toBe('#1E3A8A');
  });

  it('antes de qualquer setAccent, os signals refletem o tema padrão', () => {
    const tema = TestBed.inject(ThemeService);

    expect(tema.accent()).toBe(tokens.accent);
    expect(tema.accentContrast()).toBe(tokens['accent-contrast']);
    expect(tema.accentText()).toBe(tokens['accent-text']);
    expect(tema.palette()).toEqual(accentPalette(tokens.accent));
  });

  it('antes de qualquer setAccent, o documentElement não recebe variáveis inline', () => {
    TestBed.inject(ThemeService);

    expect(variaveis()).toEqual(['', '', '']);
  });

  it('após setAccent, os signals são atualizados', () => {
    const tema = TestBed.inject(ThemeService);

    tema.setAccent('#1E3A8A');

    expect(tema.accent()).toBe('#1E3A8A');
    expect(tema.accentContrast()).toBe('#FFFFFF');
    expect(tema.accentText()).toBe('#1E3A8A');
    expect(tema.palette()).toEqual(accentPalette('#1E3A8A'));
  });

  it('setAccent normaliza #rgb curto, sem # e minúsculas', () => {
    const tema = TestBed.inject(ThemeService);

    tema.setAccent('#f80');
    expect(tema.accent()).toBe('#FF8800');
    expect(estilo().getPropertyValue('--accent')).toBe('#FF8800');

    tema.setAccent('3aa6f0');
    expect(tema.accent()).toBe('#3AA6F0');
    expect(estilo().getPropertyValue('--accent')).toBe('#3AA6F0');
  });

  it.each(['', 'azul', '#12345', '#GGGGGG', '#22C98A80'])(
    'o hex inválido "%s" lança InvalidHexColorError e não altera variáveis nem signals',
    (invalido) => {
      const tema = TestBed.inject(ThemeService);
      tema.setAccent('#1E3A8A');
      const antes = variaveis();
      const paletaAntes = tema.palette();

      expect(() => tema.setAccent(invalido)).toThrow(InvalidHexColorError);

      expect(variaveis()).toEqual(antes);
      expect(tema.palette()).toBe(paletaAntes);
      expect(tema.accent()).toBe('#1E3A8A');
      expect(tema.accentContrast()).toBe('#FFFFFF');
      expect(tema.accentText()).toBe('#1E3A8A');
    },
  );

  it('hex inválido na primeira chamada mantém o tema padrão e não escreve variáveis', () => {
    const tema = TestBed.inject(ThemeService);

    expect(() => tema.setAccent('nope')).toThrow(InvalidHexColorError);

    expect(variaveis()).toEqual(['', '', '']);
    expect(tema.palette()).toEqual(accentPalette(tokens.accent));
  });
});
