// Ambiente de E2E (T35): `pnpm e2e [args do playwright]`.
// Cria um banco descartável (gymos_e2e_<aleatório>) no Postgres de DATABASE_ADMIN_URL, aplica as
// migrações, roda o seed, sobe a API do build com o relógio e a API de teste liberados, executa o
// Playwright e apaga o banco no fim. Sem Docker: o compose fica para o CI (ou use `services:` do
// GitHub Actions com as mesmas variáveis). Variáveis: E2E_SEM_BUILD=1 pula o build.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const raiz = resolve(import.meta.dirname, '../..');
process.chdir(raiz);
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const sufixo = randomBytes(4).toString('hex');
const banco = `gymos_e2e_${sufixo}`;
const portaDaApi = process.env.E2E_API_PORTA ?? '3100';

function comBanco(url, nome) {
  const destino = new URL(url);
  destino.pathname = `/${nome}`;
  return destino.toString();
}

const urlAdmin = process.env.DATABASE_ADMIN_URL;
if (!urlAdmin || !process.env.DATABASE_URL || !process.env.DATABASE_MIGRATOR_URL) {
  console.error('Defina DATABASE_ADMIN_URL, DATABASE_URL e DATABASE_MIGRATOR_URL (.env.example).');
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  APP_ENV: 'development',
  DATABASE_URL: comBanco(process.env.DATABASE_URL, banco),
  DATABASE_MIGRATOR_URL: comBanco(process.env.DATABASE_MIGRATOR_URL, banco),
  API_PORT: portaDaApi,
  REDIS_PREFIXO: `gymos-e2e-${sufixo}`,
  EMAIL_TRANSPORTE: 'fake',
  FILAS_PROCESSAR: 'false',
  E2E_API_URL: `http://localhost:${portaDaApi}`,
};

function executar(descricao, comando, args, opcoes = {}) {
  console.log(`\n▶ ${descricao}`);
  const resultado = spawnSync(comando, args, { stdio: 'inherit', env, shell: true, ...opcoes });
  if (resultado.status !== 0) {
    throw new Error(`${descricao} falhou (código ${resultado.status}).`);
  }
}

async function apagarBanco() {
  const cliente = new pg.Client({ connectionString: urlAdmin });
  await cliente.connect();
  try {
    await cliente.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [banco],
    );
    await cliente.query(`DROP DATABASE IF EXISTS "${banco}"`);
  } finally {
    await cliente.end();
  }
}

async function aguardarApi() {
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    try {
      if ((await fetch(`${env.E2E_API_URL}/health/live`)).ok) {
        return;
      }
    } catch {
      // ainda subindo
    }
    await new Promise((fim) => setTimeout(fim, 500));
  }
  throw new Error('A API do E2E não respondeu em /health/live.');
}

let api;
let codigo = 1;
try {
  if (!process.env.E2E_SEM_BUILD) {
    executar('Build da API e dos apps', 'pnpm', [
      'nx',
      'run-many',
      '-t',
      'build',
      '-p',
      'api',
      'staff-web',
      'student-app',
    ]);
  }
  // O preparar-banco lê o nome do banco de DATABASE_URL, então cria o banco descartável.
  executar('Banco descartável', 'node', ['dist/apps/api/gymos.js', 'preparar-banco']);
  executar('Migrações', 'pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(raiz, 'apps/api'),
  });
  executar('Seed', 'node', ['dist/apps/api/gymos.js', 'seed']);

  console.log(`\n▶ API do E2E em ${env.E2E_API_URL} (banco ${banco})`);
  api = spawn('node', ['dist/apps/api/main.js'], { stdio: 'inherit', env });
  await aguardarApi();

  const argumentos = [
    'playwright',
    'test',
    '-c',
    'apps/e2e/playwright.config.ts',
    ...process.argv.slice(2),
  ];
  const resultado = spawnSync('pnpm', ['exec', ...argumentos], {
    stdio: 'inherit',
    env,
    shell: true,
  });
  codigo = resultado.status ?? 1;
} catch (erro) {
  console.error(erro instanceof Error ? erro.message : erro);
} finally {
  api?.kill();
  await apagarBanco().catch((erro) => console.error(`Não apaguei ${banco}: ${erro.message}`));
}
process.exit(codigo);
