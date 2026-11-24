import { verificarConvencaoDeRls } from '../../platform/infra/database/convencao-rls';
import { usarBancoDeTeste } from '../../platform/testing/banco-de-teste';

describe('tabela modulo_do_tenant', () => {
  const banco = usarBancoDeTeste();

  it('segue a convenção de RLS por tenant', async () => {
    const migrador = await banco.conectarComoMigrador();

    expect(await verificarConvencaoDeRls(migrador, { tabelas: ['modulo_do_tenant'] })).toEqual([]);
  });
});
