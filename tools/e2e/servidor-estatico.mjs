// Serve o build estático de um app Angular para o E2E (T35): `node tools/e2e/servidor-estatico.mjs
// <pasta> <porta>`. Rotas sem arquivo caem no index.html (SPA) e /api é repassado para a API do
// ambiente (E2E_API_URL, por padrão http://localhost:3100); nas telas da regressão visual a
// API é interceptada pelo Playwright e este repasse nem é usado.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const [pasta, porta] = process.argv.slice(2);
if (!pasta || !porta) {
  console.error('Uso: node tools/e2e/servidor-estatico.mjs <pasta> <porta>');
  process.exit(1);
}
const raiz = resolve(pasta);
if (!existsSync(join(raiz, 'index.html'))) {
  console.error(`Sem build em ${raiz}: rode "pnpm nx run-many -t build -p staff-web student-app".`);
  process.exit(1);
}
const api = new URL(process.env.E2E_API_URL ?? 'http://localhost:3100');

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function repassarParaApi(req, res) {
  const saida = request(
    {
      hostname: api.hostname,
      port: api.port,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (resposta) => {
      res.writeHead(resposta.statusCode ?? 502, resposta.headers);
      resposta.pipe(res);
    },
  );
  saida.on('error', () => {
    res.writeHead(502).end('API do E2E indisponível');
  });
  req.pipe(saida);
}

createServer((req, res) => {
  const caminho = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (caminho.startsWith('/api/') || caminho === '/api') {
    return repassarParaApi(req, res);
  }
  let arquivo = normalize(join(raiz, caminho));
  if (!arquivo.startsWith(raiz)) {
    return res.writeHead(403).end();
  }
  if (!existsSync(arquivo) || statSync(arquivo).isDirectory()) {
    arquivo = join(raiz, 'index.html');
  }
  res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
  createReadStream(arquivo).pipe(res);
}).listen(Number(porta), () => console.log(`E2E: ${raiz} em http://localhost:${porta}`));
