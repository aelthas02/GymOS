import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Client } from 'pg';
import { verificarConvencaoDeRls } from '../../src/modules/platform/infra/database/convencao-rls';
import { usarBancoDeTeste } from '../../src/modules/platform/testing/banco-de-teste';
import geradorDeTabela from './gerador';

function migracaoGerada(tree: Tree): string {
  const pasta = 'apps/api/prisma/migrations';
  const [migracao] = tree.children(pasta);
  const sql = migracao ? tree.read(`${pasta}/${migracao}/migration.sql`, 'utf-8') : null;
  if (!sql) {
    throw new Error('o gerador não criou a migração');
  }
  return sql;
}

describe('gerador @gymos/api:tabela', () => {
  const banco = usarBancoDeTeste();
  let migrador: Client;

  beforeAll(async () => {
    migrador = await banco.conectarComoMigrador();
  });

  it('a tabela gerada passa no teste de convenção sem edição manual', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await geradorDeTabela(tree, { dominio: 'exemplo', nome: 'item-de-exemplo' });

    await migrador.query('BEGIN');
    try {
      await migrador.query(migracaoGerada(tree));

      const violacoes = await verificarConvencaoDeRls(migrador, {
        tabelas: ['item_de_exemplo'],
      });

      expect(violacoes).toEqual([]);
    } finally {
      await migrador.query('ROLLBACK');
    }
  });
});
