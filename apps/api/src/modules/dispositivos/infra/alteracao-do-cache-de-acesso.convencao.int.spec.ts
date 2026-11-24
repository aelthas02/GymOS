import { verificarConvencaoDeRls } from '../../platform/infra/database/convencao-rls';
import { usarBancoDeTeste } from '../../platform/testing/banco-de-teste';

describe('tabela alteracao_do_cache_de_acesso', () => {
  const banco = usarBancoDeTeste();

  it('segue a convenção de RLS por tenant', async () => {
    const migrador = await banco.conectarComoMigrador();

    expect(
      await verificarConvencaoDeRls(migrador, { tabelas: ['alteracao_do_cache_de_acesso'] }),
    ).toEqual([]);
  });
});
