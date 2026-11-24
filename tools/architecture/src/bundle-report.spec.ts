import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { analisar, LIMITE_CHUNK_LAZY, LIMITE_INICIAL } from '../ci/bundle-report.ts';

let dir: string;

// Bytes aleatórios não comprimem: o tamanho gzip fica perto do bruto.
const js = (bytes: number): Buffer => randomBytes(bytes);

function montar(inicial: number, lazy: number): void {
  writeFileSync(
    join(dir, 'index.html'),
    '<html><head><link rel="modulepreload" href="chunk-A.js"></head>' +
      '<body><script src="main-B.js" type="module"></script></body></html>',
  );
  writeFileSync(join(dir, 'main-B.js'), js(inicial));
  writeFileSync(join(dir, 'chunk-A.js'), js(10));
  writeFileSync(join(dir, 'chunk-LAZY.js'), js(lazy));
  mkdirSync(join(dir, 'fonts'), { recursive: true });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bundle-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('relatório de bundle (portão do T03)', () => {
  it('soma como inicial os scripts e modulepreloads do index.html e como lazy o resto', () => {
    montar(2000, 1000);

    const relatorio = analisar(dir, 'staff-web');

    expect(relatorio.arquivos.filter((a) => a.inicial).map((a) => a.arquivo)).toEqual([
      'chunk-A.js',
      'main-B.js',
    ]);
    expect(relatorio.arquivos.find((a) => a.arquivo === 'chunk-LAZY.js')?.inicial).toBe(false);
    expect(relatorio.erros).toEqual([]);
  });

  it('falha quando o JS inicial comprimido passa de 250 kB', () => {
    montar(LIMITE_INICIAL + 1000, 1000);

    const { erros } = analisar(dir, 'staff-web');

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/inicial/);
  });

  it('falha quando um chunk lazy comprimido passa de 80 kB', () => {
    montar(2000, LIMITE_CHUNK_LAZY + 1000);

    const { erros } = analisar(dir, 'staff-web');

    expect(erros).toHaveLength(1);
    expect(erros[0]).toMatch(/chunk-LAZY\.js/);
  });
});
