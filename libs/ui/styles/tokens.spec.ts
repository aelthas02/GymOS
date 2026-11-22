import tokensCss from './tokens.css?raw';
import { tokens } from './tokens';

function customProperties(css: string): Map<string, string> {
  const declaracoes = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g);

  return new Map([...declaracoes].map(([, nome = '', valor = '']) => [nome, valor.trim()]));
}

describe('espelho TS dos tokens', () => {
  const css = customProperties(tokensCss);

  it('tokens.ts e tokens.css têm as mesmas chaves', () => {
    expect(Object.keys(tokens).sort()).toEqual([...css.keys()].sort());
  });

  it('tokens.ts e tokens.css têm os mesmos valores', () => {
    expect(Object.fromEntries(css)).toEqual({ ...tokens });
  });
});
