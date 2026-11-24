import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste } from '../modules/platform/testing/app-de-teste';
import { usarBancoDeTeste } from '../modules/platform/testing/banco-de-teste';
import { comTenant } from '../modules/platform/testing/fabricas';
import type { ModuloDeSeed } from './modulo-de-seed';
import { MODULOS_DE_SEED } from './modulos';
import { ACADEMIA_RITMO } from './plataforma';
import { executarSeed } from './runner';

describe('runner de seed', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
  });

  it('roda os módulos registrados duas vezes sem duplicar dados', async () => {
    const dentroDoTenant: string[] = [];
    const sonda: ModuloDeSeed = {
      nome: 'sonda',
      dependeDe: ['autenticacao'],
      executar: (_app, contexto) =>
        contexto.noTenant(async (tenantId) => {
          dentroDoTenant.push(tenantId);
        }),
    };
    const modulos = [...MODULOS_DE_SEED, sonda];

    expect(await executarSeed(app, modulos)).toEqual(['plataforma', 'autenticacao', 'sonda']);
    await executarSeed(app, modulos);

    const conexao = await banco.conectarComoApp();
    const { rows } = await conexao.query<{ id: string }>(
      'SELECT id FROM gymos_tenant_por_slug($1)',
      [ACADEMIA_RITMO.slug],
    );
    expect(rows).toHaveLength(1);
    expect(dentroDoTenant).toEqual([rows[0]?.id, rows[0]?.id]);
    const total = await comTenant(conexao, rows[0]?.id ?? '', async () => {
      const [unidades, usuarios] = await Promise.all([
        conexao.query<{ n: string }>('SELECT count(*) AS n FROM unidade'),
        conexao.query<{ n: string }>('SELECT count(*) AS n FROM usuario'),
      ]);
      return [unidades.rows[0]?.n, usuarios.rows[0]?.n];
    });
    expect(total).toEqual(['1', '4']);
  });
});
