import { join } from 'node:path';
import { buildSync } from 'esbuild';
import type { Page } from '@playwright/test';

export const URL_DA_DEMONSTRACAO = 'http://localhost/teclado-demo';

const NUCLEO = join(__dirname, '../../forms/src/lib/teclado/nucleo.ts');

/** Empacota o núcleo real (o mesmo do serviço e da diretiva) como script da página. */
function empacotarNucleo(): string {
  const resultado = buildSync({
    entryPoints: [NUCLEO],
    bundle: true,
    format: 'iife',
    globalName: 'Teclado',
    write: false,
    target: 'es2022',
  });
  return resultado.outputFiles.map((arquivo) => arquivo.text).join('');
}

function html(): string {
  const campos = Array.from(
    { length: 14 },
    (_, i) =>
      `<label>Campo ${i + 1}<input id="campo-${i + 1}" type="text" autocomplete="off" /></label>`,
  ).join('\n');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content" />
<style>
  body { margin: 0; font: 16px sans-serif; }
  form { padding: 16px 16px calc(96px + var(--teclado-altura, 0px)); }
  label { display: block; margin-bottom: 24px; }
  input { display: block; box-sizing: border-box; width: 100%; height: 40px; }
  footer { position: fixed; left: 0; right: 0; bottom: var(--teclado-altura, 0px); height: 56px;
    box-sizing: border-box; padding: 8px 16px; background: Canvas; border-top: 1px solid GrayText; }
  footer button { height: 40px; width: 100%; }
</style></head>
<body>
<form data-teclado-seguro>
${campos}
</form>
<footer id="rodape"><button id="salvar" type="button">Salvar</button></footer>
<script>${empacotarNucleo()}</script>
<script>
  Teclado.observarTeclado(window, (e) => {
    window.__teclado = e;
    Teclado.publicarAltura(document, e.alturaDoTeclado);
  });
  Teclado.rolarCampoFocadoParaOCentro(
    document.querySelector('[data-teclado-seguro]'),
    () => window.__teclado,
  );
</script>
</body></html>`;
}

/** Abre a página de demonstração (formulário longo, rodapé fixo) com o núcleo do teclado ligado. */
export async function abrirPaginaDeDemonstracao(page: Page): Promise<void> {
  await page.route(URL_DA_DEMONSTRACAO, (route) =>
    route.fulfill({ contentType: 'text/html', body: html() }),
  );
  await page.goto(URL_DA_DEMONSTRACAO);
}
