import type { INestApplicationContext } from '@nestjs/common';
import { TempoRealPorTenant } from '../../application/eventos';
import type { Tenant } from '../../domain/tenant';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarModuloDeEventos, tenantFicticio } from '../../testing/eventos-de-teste';
import { aguardar, usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { TopicoInvalidoError } from './tempo-real.redis';

describe('assinaturas de tempo real', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;
  const academia = tenantFicticio('academia-a');

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis);
  });

  const noTenant = <T>(tenant: Tenant, fn: (tempoReal: TempoRealPorTenant) => Promise<T>) =>
    modulo.get(ContextoDoTenant).executar({ tenant }, () => fn(modulo.get(TempoRealPorTenant)));

  it('cancelar a assinatura para de receber', async () => {
    const cancelada: unknown[] = [];
    const sentinela: unknown[] = [];
    const cancelar = await noTenant(academia, (t) =>
      t.assinar('cancela', (m) => cancelada.push(m)),
    );
    await noTenant(academia, (t) => t.assinar('cancela', (m) => sentinela.push(m)));

    await noTenant(academia, (t) => t.publicar('cancela', 1));
    await aguardar(() => cancelada.length === 1, { descricao: 'a primeira mensagem' });
    await cancelar();
    await noTenant(academia, (t) => t.publicar('cancela', 2));
    await aguardar(() => sentinela.length === 2, { descricao: 'a segunda no outro ouvinte' });

    expect(cancelada).toEqual([1]);
  });

  it('dois ouvintes no mesmo canal recebem a mesma mensagem', async () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    await noTenant(academia, (t) => t.assinar('dupla', (m) => a.push(m)));
    await noTenant(academia, (t) => t.assinar('dupla', (m) => b.push(m)));

    await noTenant(academia, (t) => t.publicar('dupla', { ok: true }));
    await aguardar(() => a.length > 0 && b.length > 0, { descricao: 'os dois ouvintes' });

    expect(a).toEqual([{ ok: true }]);
    expect(b).toEqual([{ ok: true }]);
  });

  it('tópico inválido é recusado ao publicar e ao assinar', async () => {
    await expect(noTenant(academia, (t) => t.publicar('Inválido:x', 1))).rejects.toBeInstanceOf(
      TopicoInvalidoError,
    );
    await expect(
      noTenant(academia, (t) => t.assinar('a*', () => undefined)),
    ).rejects.toBeInstanceOf(TopicoInvalidoError);
  });
});
