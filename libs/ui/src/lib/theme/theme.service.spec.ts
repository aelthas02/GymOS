import { TestBed } from '@angular/core/testing';
import { accentText } from '../../../styles/contrast';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const estilo = (): CSSStyleDeclaration => document.documentElement.style;

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
});
