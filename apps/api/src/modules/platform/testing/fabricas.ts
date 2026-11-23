import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';

// Fábricas de tenant e unidade para testes de integração. Usam a conexão do gymos_app, então passam
// pelas mesmas funções e políticas da API: o tenant pela função gymos_criar_tenant e a unidade dentro
// de uma transação com app.tenant_id.

export interface TenantCriado {
  id: string;
  slug: string;
  nome: string;
}

export function slugAleatorio(prefixo = 'academia'): string {
  return `${prefixo}-${randomBytes(4).toString('hex')}`;
}

export async function criarTenant(
  app: Client,
  dados: { slug?: string; nome?: string; corDestaque?: string } = {},
): Promise<TenantCriado> {
  const slug = dados.slug ?? slugAleatorio();
  const nome = dados.nome ?? `Academia ${slug}`;
  const { rows } = await app.query<{ id: string }>(
    'SELECT gymos_criar_tenant($1, $2, $3, NULL, $4) AS id',
    [slug, nome, dados.corDestaque ?? '#22C98A', 'base'],
  );
  const id = rows[0]?.id;
  if (!id) {
    throw new Error(`gymos_criar_tenant não devolveu o id de ${slug}`);
  }
  return { id, slug, nome };
}

export async function comTenant<T>(
  app: Client,
  tenantId: string,
  fn: (app: Client) => Promise<T>,
): Promise<T> {
  await app.query('BEGIN');
  try {
    await app.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const resultado = await fn(app);
    await app.query('COMMIT');
    return resultado;
  } catch (error) {
    await app.query('ROLLBACK');
    throw error;
  }
}

export async function criarUnidade(app: Client, tenantId: string, nome: string): Promise<string> {
  return comTenant(app, tenantId, async () => {
    const { rows } = await app.query<{ id: string }>(
      'INSERT INTO unidade (tenant_id, nome) VALUES ($1, $2) RETURNING id',
      [tenantId, nome],
    );
    return rows[0]?.id ?? '';
  });
}

export async function criarReferenciaExterna(
  app: Client,
  tenantId: string,
  dados: { provedor: string; idExterno: string; recurso: string; recursoId: string },
): Promise<string> {
  return comTenant(app, tenantId, async () => {
    const { rows } = await app.query<{ id: string }>(
      'INSERT INTO referencia_externa (tenant_id, provedor, id_externo, recurso, recurso_id) ' +
        'VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [tenantId, dados.provedor, dados.idExterno, dados.recurso, dados.recursoId],
    );
    return rows[0]?.id ?? '';
  });
}
