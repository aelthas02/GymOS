import type { Client } from 'pg';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { verificarConvencaoDeRls } from './convencao-rls';

describe('convenção de tabela (RLS por tenant)', () => {
  const banco = usarBancoDeTeste();
  let migrador: Client;

  beforeAll(async () => {
    migrador = await banco.conectarComoMigrador();
  });

  it('toda tabela criada pelas migrações segue a convenção', async () => {
    expect(await verificarConvencaoDeRls(migrador)).toEqual([]);
  });

  it('uma tabela de exemplo sem política faz a verificação falhar', async () => {
    await migrador.query('BEGIN');
    try {
      await migrador.query(
        'CREATE TABLE exemplo_sem_politica (id uuid PRIMARY KEY, tenant_id uuid NOT NULL)',
      );
      await migrador.query('CREATE INDEX ON exemplo_sem_politica (tenant_id)');
      await migrador.query('ALTER TABLE exemplo_sem_politica ENABLE ROW LEVEL SECURITY');
      await migrador.query('ALTER TABLE exemplo_sem_politica FORCE ROW LEVEL SECURITY');

      const violacoes = await verificarConvencaoDeRls(migrador);

      expect(violacoes).toContainEqual(
        expect.objectContaining({ tabela: 'exemplo_sem_politica', regra: 'politica' }),
      );
    } finally {
      await migrador.query('ROLLBACK');
    }
  });
});
