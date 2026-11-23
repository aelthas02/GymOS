import type { INestApplicationContext } from '@nestjs/common';
import { CacheComTenant } from '../../application/eventos';
import type { Tenant } from '../../domain/tenant';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarModuloDeEventos, tenantFicticio } from '../../testing/eventos-de-teste';
import { usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

describe('cache por tenant', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;
  const academiaA = tenantFicticio('academia-a');
  const academiaB = tenantFicticio('academia-b');

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis);
  });

  const noTenant = <T>(tenant: Tenant, fn: (cache: CacheComTenant) => Promise<T>): Promise<T> =>
    modulo.get(ContextoDoTenant).executar({ tenant }, () => fn(modulo.get(CacheComTenant)));

  it('a mesma chave lógica nos tenants A e B guarda e devolve valores diferentes', async () => {
    const opcoes = { ttlSegundos: 60 };
    await noTenant(academiaA, (cache) =>
      cache.obter(
        ['resumo-financeiro'],
        () => Promise.resolve({ recebidoEmCentavos: 100 }),
        opcoes,
      ),
    );
    await noTenant(academiaB, (cache) =>
      cache.obter(
        ['resumo-financeiro'],
        () => Promise.resolve({ recebidoEmCentavos: 200 }),
        opcoes,
      ),
    );

    const naoDeviaCarregar = () => Promise.reject(new Error('devia vir do cache'));
    expect(
      await noTenant(academiaA, (cache) =>
        cache.obter(['resumo-financeiro'], naoDeviaCarregar, opcoes),
      ),
    ).toEqual({ recebidoEmCentavos: 100 });
    expect(
      await noTenant(academiaB, (cache) =>
        cache.obter(['resumo-financeiro'], naoDeviaCarregar, opcoes),
      ),
    ).toEqual({ recebidoEmCentavos: 200 });
  });
});
