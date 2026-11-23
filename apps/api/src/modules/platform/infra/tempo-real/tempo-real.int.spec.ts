import type { INestApplicationContext } from '@nestjs/common';
import { TempoRealPorTenant } from '../../application/eventos';
import type { Tenant } from '../../domain/tenant';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarModuloDeEventos, tenantFicticio } from '../../testing/eventos-de-teste';
import { aguardar, usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';

describe('tempo real por tenant', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;
  const academiaA = tenantFicticio('academia-a');
  const academiaB = tenantFicticio('academia-b');

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis);
  });

  const noTenant = <T>(tenant: Tenant, fn: (tempoReal: TempoRealPorTenant) => Promise<T>) =>
    modulo.get(ContextoDoTenant).executar({ tenant }, () => fn(modulo.get(TempoRealPorTenant)));

  it('assinante do canal de A não recebe mensagem publicada em B', async () => {
    const recebidasEmA: unknown[] = [];
    const cancelar = await noTenant(academiaA, (tempoReal) =>
      tempoReal.assinar('recepcao', (mensagem) => recebidasEmA.push(mensagem)),
    );

    await noTenant(academiaB, (tempoReal) => tempoReal.publicar('recepcao', { de: 'B' }));
    await noTenant(academiaA, (tempoReal) => tempoReal.publicar('recepcao', { de: 'A' }));
    await aguardar(() => recebidasEmA.length > 0, { descricao: 'a mensagem de A' });

    expect(recebidasEmA).toEqual([{ de: 'A' }]);
    await cancelar();
  });
});
