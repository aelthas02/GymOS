import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

export interface OpcoesDeRollback {
  /** Conexão com o dono das tabelas (gymos_migrator). */
  url: string;
  /** Pasta `prisma/migrations`. */
  diretorio: string;
  nome: string;
}

/**
 * O Prisma não tem migração "down". Cada migração que precisa de rollback guarda um `down.sql` ao
 * lado do `migration.sql`; aqui ele roda numa transação junto com a remoção do registro em
 * `_prisma_migrations`, o que deixa a migração pendente para um novo `migrate deploy`.
 * Só a última migração aplicada pode ser revertida (rollback é sempre em ordem inversa).
 */
export async function reverterMigracao({ url, diretorio, nome }: OpcoesDeRollback): Promise<void> {
  const arquivo = join(diretorio, nome, 'down.sql');
  if (!existsSync(arquivo)) {
    throw new Error(
      `A migração ${nome} não tem down.sql; reverta pelo procedimento manual do runbook.`,
    );
  }
  const down = readFileSync(arquivo, 'utf8');

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ migration_name: string }>(
      'SELECT migration_name FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY migration_name DESC LIMIT 1',
    );
    if (rows[0]?.migration_name !== nome) {
      throw new Error(
        `${nome} não é a última migração aplicada (a última é ${rows[0]?.migration_name ?? 'nenhuma'}).`,
      );
    }
    await client.query(down);
    await client.query('DELETE FROM _prisma_migrations WHERE migration_name = $1', [nome]);
    await client.query('COMMIT');
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    await client.end();
  }
}

// Uso: DATABASE_MIGRATOR_URL=... node tools/architecture/ci/rollback-migracao.ts <nome-da-migracao>
if (import.meta.main) {
  const nome = process.argv[2];
  const url = process.env['DATABASE_MIGRATOR_URL'];
  if (!nome || !url) {
    console.error(
      'Uso: DATABASE_MIGRATOR_URL=... node tools/architecture/ci/rollback-migracao.ts <nome-da-migracao>',
    );
    process.exit(2);
  }
  reverterMigracao({ url, diretorio: 'apps/api/prisma/migrations', nome }).then(
    () => console.log(`Migração ${nome} revertida.`),
    (erro: unknown) => {
      console.error(erro instanceof Error ? erro.message : erro);
      process.exit(1);
    },
  );
}
