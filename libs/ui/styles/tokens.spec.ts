import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accentContrast, accentText } from './contrast';
import { tokens } from './tokens';

// O Vitest troca imports de .css por módulos vazios, até com ?raw; por isso a leitura direta.
const tokensCss = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8');

function customProperties(css: string): Map<string, string> {
  const declaracoes = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g);

  return new Map([...declaracoes].map(([, nome = '', valor = '']) => [nome, valor.trim()]));
}

// O Prettier escreve os hex do CSS em minúsculas; o TS segue o formato #RRGGBB.
const semCaixa = (valores: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(valores).map(([nome, valor]) => [nome, valor.toLowerCase()]));

describe('espelho TS dos tokens', () => {
  const css = customProperties(tokensCss);

  it('tokens.ts e tokens.css têm as mesmas chaves', () => {
    expect(Object.keys(tokens).sort()).toEqual([...css.keys()].sort());
  });

  it('tokens.ts e tokens.css têm os mesmos valores', () => {
    expect(semCaixa(Object.fromEntries(css))).toEqual(semCaixa(tokens));
  });

  it('o tema padrão do CSS é o calculado para o acento padrão', () => {
    expect(tokens['accent-contrast']).toBe(accentContrast(tokens.accent));
    expect(tokens['accent-text']).toBe(accentText(tokens.accent));
  });
});
