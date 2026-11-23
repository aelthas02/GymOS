import { Client } from 'pg';

// Papéis e bancos do Postgres (ADR-003). Roda com um papel administrador (CREATEDB e CREATEROLE):
// no dev, `pnpm gymos preparar-banco`; nos testes de integração, o globalSetup do Vitest.
// gymos_migrator é dono das tabelas e aplica as migrações; gymos_app é o papel da API e dos workers.
// Nenhum dos dois é superusuário nem tem BYPASSRLS.

export interface Credenciais {
  usuario: string;
  senha: string;
}

export function credenciaisDaUrl(url: string): Credenciais {
  const { username, password } = new URL(url);
  return { usuario: decodeURIComponent(username), senha: decodeURIComponent(password) };
}

export function urlComBanco(url: string, banco: string): string {
  const destino = new URL(url);
  destino.pathname = `/${banco}`;
  return destino.toString();
}

export async function comCliente<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function codigoDoErro(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined;
}

const PAPEL_JA_EXISTE = '42710';
const BANCO_EM_USO = '55006';

export async function garantirPapeis(urlAdmin: string, papeis: Credenciais[]): Promise<void> {
  await comCliente(urlAdmin, async (client) => {
    for (const { usuario, senha } of papeis) {
      const { rows } = await client.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
        'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = $1',
        [usuario],
      );
      const existente = rows[0];
      if (existente) {
        if (existente.rolsuper || existente.rolbypassrls) {
          throw new Error(`O papel ${usuario} não pode ser superusuário nem ter BYPASSRLS.`);
        }
        continue;
      }
      try {
        await client.query(
          `CREATE ROLE ${client.escapeIdentifier(usuario)} LOGIN PASSWORD ${client.escapeLiteral(senha)} ` +
            'NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',
        );
      } catch (error) {
        // Outra execução em paralelo criou o papel entre a consulta e o CREATE.
        if (codigoDoErro(error) !== PAPEL_JA_EXISTE) {
          throw error;
        }
      }
    }
  });
}

export async function bancoExiste(urlAdmin: string, banco: string): Promise<boolean> {
  return comCliente(urlAdmin, async (client) => {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      banco,
    ]);
    return rowCount === 1;
  });
}

export async function criarBanco(
  urlAdmin: string,
  banco: string,
  opcoes: { modelo?: string } = {},
): Promise<void> {
  await comCliente(urlAdmin, async (client) => {
    const modelo = opcoes.modelo ? ` TEMPLATE ${client.escapeIdentifier(opcoes.modelo)}` : '';
    const sql = `CREATE DATABASE ${client.escapeIdentifier(banco)}${modelo}`;
    for (let tentativa = 1; ; tentativa++) {
      try {
        await client.query(sql);
        return;
      } catch (error) {
        // O modelo não pode ter conexões abertas (o autovacuum às vezes abre uma).
        if (codigoDoErro(error) !== BANCO_EM_USO || tentativa === 10) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 200 * tentativa));
      }
    }
  });
}

export async function concederAcesso(
  urlAdmin: string,
  banco: string,
  papeis: { migrador: Credenciais; app: Credenciais },
): Promise<void> {
  await comCliente(urlComBanco(urlAdmin, banco), async (client) => {
    const migrador = client.escapeIdentifier(papeis.migrador.usuario);
    const app = client.escapeIdentifier(papeis.app.usuario);
    await client.query(
      `GRANT CONNECT ON DATABASE ${client.escapeIdentifier(banco)} TO ${migrador}, ${app}`,
    );
    await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
    await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${migrador}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${app}`);
  });
}

export async function apagarBanco(urlAdmin: string, banco: string): Promise<void> {
  await comCliente(urlAdmin, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${client.escapeIdentifier(banco)} WITH (FORCE)`);
  });
}

export async function apagarBancosComPrefixo(urlAdmin: string, prefixo: string): Promise<void> {
  const nomes = await comCliente(urlAdmin, async (client) => {
    const { rows } = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE $1 || '%'",
      [prefixo],
    );
    return rows.map((row) => row.datname);
  });
  for (const nome of nomes) {
    await apagarBanco(urlAdmin, nome);
  }
}

// Papéis, banco (se ainda não existir) e privilégios de schema. Idempotente.
export async function prepararBanco(opcoes: {
  urlAdmin: string;
  banco: string;
  migrador: Credenciais;
  app: Credenciais;
}): Promise<{ bancoCriado: boolean }> {
  const { urlAdmin, banco, migrador, app } = opcoes;
  await garantirPapeis(urlAdmin, [migrador, app]);
  const bancoCriado = !(await bancoExiste(urlAdmin, banco));
  if (bancoCriado) {
    await criarBanco(urlAdmin, banco);
  }
  await concederAcesso(urlAdmin, banco, { migrador, app });
  return { bancoCriado };
}
