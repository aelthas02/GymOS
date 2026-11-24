import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste } from '../modules/platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../modules/platform/testing/banco-de-teste';
import { comTenant } from '../modules/platform/testing/fabricas';
import { contextoDoSeed } from './runner';
import { ACADEMIA_RITMO, seedDaPlataforma } from './plataforma';

describe('seed da plataforma', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
  });

  it('cria a Academia Ritmo com a Unidade Centro e não duplica ao rodar de novo', async () => {
    await seedDaPlataforma.executar(app, contextoDoSeed(app));
    await seedDaPlataforma.executar(app, contextoDoSeed(app));

    const conexao = await banco.conectarComoApp();
    const { rows: tenants } = await conexao.query<{ id: string; nome: string }>(
      'SELECT id, nome FROM gymos_tenant_por_slug($1)',
      [ACADEMIA_RITMO.slug],
    );
    expect(tenants).toEqual([expect.objectContaining({ nome: 'Academia Ritmo' })]);
    const unidades = await comTenant(conexao, tenants[0]?.id ?? '', async () => {
      const { rows } = await conexao.query<{ nome: string }>('SELECT nome FROM unidade');
      return rows.map((row) => row.nome);
    });
    expect(unidades).toEqual(['Unidade Centro']);
  });
});
