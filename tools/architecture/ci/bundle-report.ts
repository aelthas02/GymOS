import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
/** JS inicial comprimido por app (ticket T03). O budget do angular.json mede o bruto; este mede o gzip. */
export const LIMITE_INICIAL = 250 * KB;
/** Cada chunk lazy comprimido. */
export const LIMITE_CHUNK_LAZY = 80 * KB;

export interface ArquivoJs {
  arquivo: string;
  bytes: number;
  gzip: number;
  inicial: boolean;
}

export interface RelatorioDeBundle {
  app: string;
  arquivos: ArquivoJs[];
  inicialGzip: number;
  erros: string[];
}

function arquivosIniciais(html: string): Set<string> {
  const referencias = html.matchAll(/(?:src|href)="\/?([^"]+\.js)"/g);
  return new Set([...referencias].map((m) => m[1] as string));
}

/** Lê o build (`dist/apps/<app>/browser`) e confere os limites de JS comprimido. */
export function analisar(dirDoBuild: string, app: string): RelatorioDeBundle {
  const iniciais = arquivosIniciais(readFileSync(join(dirDoBuild, 'index.html'), 'utf8'));
  const arquivos = readdirSync(dirDoBuild)
    .filter((nome) => nome.endsWith('.js'))
    .sort()
    .map((arquivo): ArquivoJs => {
      const conteudo = readFileSync(join(dirDoBuild, arquivo));
      return {
        arquivo,
        bytes: conteudo.length,
        gzip: gzipSync(conteudo).length,
        inicial: iniciais.has(arquivo),
      };
    });

  const inicialGzip = arquivos.filter((a) => a.inicial).reduce((soma, a) => soma + a.gzip, 0);
  const erros: string[] = [];
  if (inicialGzip > LIMITE_INICIAL) {
    erros.push(
      `${app}: JS inicial com ${kb(inicialGzip)} comprimido (limite ${kb(LIMITE_INICIAL)})`,
    );
  }
  for (const a of arquivos.filter((item) => !item.inicial && item.gzip > LIMITE_CHUNK_LAZY)) {
    erros.push(
      `${app}: chunk lazy ${a.arquivo} com ${kb(a.gzip)} comprimido (limite ${kb(LIMITE_CHUNK_LAZY)})`,
    );
  }
  return { app, arquivos, inicialGzip, erros };
}

const kb = (bytes: number): string => `${(bytes / KB).toFixed(1)} kB`;

export function formatarMarkdown(relatorio: RelatorioDeBundle): string {
  const linhas = relatorio.arquivos.map(
    (a) => `| ${a.arquivo} | ${a.inicial ? 'inicial' : 'lazy'} | ${kb(a.bytes)} | ${kb(a.gzip)} |`,
  );
  return [
    `## Bundle de ${relatorio.app}`,
    '',
    `JS inicial comprimido: **${kb(relatorio.inicialGzip)}** de ${kb(LIMITE_INICIAL)}.`,
    '',
    '| Arquivo | Tipo | Bruto | Gzip |',
    '| --- | --- | --- | --- |',
    ...linhas,
    '',
    ...relatorio.erros.map((erro) => `- FALHA: ${erro}`),
  ].join('\n');
}

// Uso: node tools/architecture/ci/bundle-report.ts <app> [pasta do build]
if (import.meta.main) {
  const [app, pasta = join('dist', 'apps', process.argv[2] ?? '', 'browser')] =
    process.argv.slice(2);
  if (!app) {
    console.error('Uso: node tools/architecture/ci/bundle-report.ts <app> [pasta do build]');
    process.exit(2);
  }
  const relatorio = analisar(pasta, app);
  mkdirSync(join('dist', 'reports'), { recursive: true });
  writeFileSync(join('dist', 'reports', `bundle-${app}.json`), JSON.stringify(relatorio, null, 2));
  writeFileSync(join('dist', 'reports', `bundle-${app}.md`), formatarMarkdown(relatorio));
  console.log(formatarMarkdown(relatorio));
  process.exit(relatorio.erros.length ? 1 : 0);
}
