import type { INestApplicationContext } from '@nestjs/common';
import type { Client } from 'pg';
import { PublicadorDeEventos } from '../../application/eventos';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import {
  criarModuloDeEventos,
  eventosNoOutbox,
  pagamentoConfirmado,
} from '../../testing/eventos-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';
import { usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';

describe('outbox transacional', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;
  let migrador: Client;
  let tenant: TenantCriado;

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis);
    migrador = await banco.conectarComoMigrador();
    tenant = await criarTenant(await banco.conectarComoApp());
  });

  it('rollback da transação do caso de uso não publica o evento', async () => {
    const executor = modulo.get(ExecutorDeTenant);
    const publicador = modulo.get(PublicadorDeEventos);

    await expect(
      executor.runAsTenant(tenant.id, async () => {
        await publicador.publicar(pagamentoConfirmado());
        throw new Error('o caso de uso falhou depois de publicar');
      }),
    ).rejects.toThrow('o caso de uso falhou depois de publicar');

    expect(await eventosNoOutbox(migrador, tenant.id)).toEqual([]);
  });

  it('o commit grava o evento com o tenant da transação, ainda não publicado', async () => {
    const executor = modulo.get(ExecutorDeTenant);
    const publicador = modulo.get(PublicadorDeEventos);

    const evento = await executor.runAsTenant(tenant.id, () =>
      publicador.publicar(pagamentoConfirmado({ valorEmCentavos: 9_990 })),
    );

    expect(evento).toMatchObject({
      tipo: 'PagamentoConfirmado',
      versao: 1,
      tenantId: tenant.id,
      payload: { valorEmCentavos: 9_990 },
    });
    expect(await eventosNoOutbox(migrador, tenant.id)).toEqual([
      { id: evento.id, publicado: false },
    ]);
  });
});
