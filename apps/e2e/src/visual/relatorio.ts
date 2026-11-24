import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const PASTA_DO_RELATORIO = resolve(__dirname, '../../../../dist/e2e/relatorio-visual');

export interface FalhaVisual {
  id: string;
  tela: string;
  projeto: string;
  fracao: number;
  limiar: number;
  pixelsDiferentes: number;
  mesmasDimensoes: boolean;
}

function pagina(titulo: string, corpo: string): string {
  return (
    `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${titulo}</title>` +
    '<style>body{font:14px system-ui;margin:24px}img{max-width:100%;border:1px solid #888}' +
    '.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}</style>' +
    corpo
  );
}

const porcento = (fracao: number): string => `${(fracao * 100).toFixed(3)}%`;

/** Grava as imagens e a página de uma falha em `<relatório>/<id>/`. */
export async function gravarFalha(
  falha: FalhaVisual,
  imagens: { referencia: Buffer; atual: Buffer; diff: Buffer },
): Promise<string> {
  const pasta = join(PASTA_DO_RELATORIO, falha.id);
  await mkdir(pasta, { recursive: true });
  await Promise.all([
    writeFile(join(pasta, 'referencia.png'), imagens.referencia),
    writeFile(join(pasta, 'atual.png'), imagens.atual),
    writeFile(join(pasta, 'diff.png'), imagens.diff),
    writeFile(join(pasta, 'falha.json'), JSON.stringify(falha, null, 2)),
  ]);
  const dimensoes = falha.mesmasDimensoes
    ? ''
    : ' As dimensões da tela e da referência são diferentes.';
  await writeFile(
    join(pasta, 'index.html'),
    pagina(
      `${falha.tela} · ${falha.projeto}`,
      `<h1>${falha.tela} · ${falha.projeto}</h1>` +
        `<p>${porcento(falha.fracao)} dos pixels diferem (limiar ${porcento(falha.limiar)}).${dimensoes}</p>` +
        '<div class="trio"><figure><figcaption>Referência (HTML)</figcaption><img src="referencia.png"></figure>' +
        '<figure><figcaption>Tela atual</figcaption><img src="atual.png"></figure>' +
        '<figure><figcaption>Diferenças</figcaption><img src="diff.png"></figure></div>',
    ),
  );
  return join(pasta, 'index.html');
}

/** Índice de todas as falhas da execução; roda no fim (globalTeardown). */
export async function gerarIndice(): Promise<void> {
  const ids = await readdir(PASTA_DO_RELATORIO).catch(() => [] as string[]);
  const falhas: FalhaVisual[] = [];
  for (const id of ids) {
    try {
      falhas.push(JSON.parse(await readFile(join(PASTA_DO_RELATORIO, id, 'falha.json'), 'utf8')));
    } catch {
      // não é uma pasta de falha
    }
  }
  if (falhas.length === 0) {
    return;
  }
  const itens = falhas
    .sort((x, y) => x.id.localeCompare(y.id))
    .map(
      (falha) =>
        `<li><a href="${falha.id}/index.html">${falha.tela} · ${falha.projeto}</a> — ${porcento(falha.fracao)}</li>`,
    )
    .join('');
  await writeFile(
    join(PASTA_DO_RELATORIO, 'index.html'),
    pagina(
      'Regressão visual',
      `<h1>Regressão visual: ${falhas.length} diferença(s)</h1><ul>${itens}</ul>`,
    ),
  );
}
