import type { Client } from 'pg';
import type { ContextoDoTenant } from '../infra/contexto/contexto-do-tenant';

// Tabela só dos testes da cifra (o Aluno é do T15a): segue a convenção de RLS e tem a constraint
// única pelo índice cego, como terá o cadastro real.

export interface Ficha {
  id: string;
  cpf: string;
  cpfHash: string | null;
  saude: string | null;
}

/** Chave mestra local de 32 bytes em base64, só para testes. */
export const CHAVE_MESTRA_DE_TESTE = Buffer.alloc(32, 7).toString('base64');

export async function criarTabelaDeFichas(migrador: Client): Promise<void> {
  const politica = `"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid`;
  await migrador.query(`
    CREATE TABLE ficha_de_teste (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL,
      cpf TEXT NOT NULL,
      cpf_hash TEXT NOT NULL,
      saude TEXT,
      CONSTRAINT ficha_de_teste_tenant_id_cpf_hash_key UNIQUE (tenant_id, cpf_hash)
    );
    ALTER TABLE ficha_de_teste ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ficha_de_teste FORCE ROW LEVEL SECURITY;
    CREATE POLICY ficha_de_teste_isolamento ON ficha_de_teste USING (${politica}) WITH CHECK (${politica});
    GRANT SELECT, INSERT, UPDATE, DELETE ON ficha_de_teste TO gymos_app;
  `);
}

export async function gravarFicha(
  contexto: ContextoDoTenant,
  tenantId: string,
  dados: Omit<Ficha, 'id'>,
): Promise<string> {
  const [linha] = await contexto.cliente().$queryRaw<Array<{ id: string }>>`
    INSERT INTO ficha_de_teste (tenant_id, cpf, cpf_hash, saude)
    VALUES (${tenantId}::uuid, ${dados.cpf}, ${dados.cpfHash}, ${dados.saude})
    RETURNING id`;
  if (!linha) {
    throw new Error('INSERT sem RETURNING');
  }
  return linha.id;
}

export async function lerFichaPorCpf(contexto: ContextoDoTenant, cpfHash: string): Promise<Ficha> {
  const [ficha] = await contexto.cliente().$queryRaw<Ficha[]>`
    SELECT id, cpf, cpf_hash AS "cpfHash", saude FROM ficha_de_teste WHERE cpf_hash = ${cpfHash}`;
  if (!ficha) {
    throw new Error(`Nenhuma ficha com o hash ${cpfHash}`);
  }
  return ficha;
}
