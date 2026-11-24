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
import { promessaControlada, usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { FilasBullMQ } from '../filas/filas.bullmq';
import { DespachanteDoOutbox } from './despachante-do-outbox';
import { RegistroDeConsumidores } from './registro-de-consumidores';

/** Libera todos só quando `total` participantes chegaram. */
function barreira(total: number): () => Promise<void> {
  let chegaram = 0;
  const todos = promessaControlada();
  return () => {
    chegaram += 1;
    if (chegaram === total) {
      todos.resolve();
    }
    return todos.promise;
  };
}

describe('despachante do outbox', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let workerA: INestApplicationContext;
  let workerB: INestApplicationContext;
  let migrador: Client;
  let tenant: TenantCriado;

  beforeAll(async () => {
    // Dois "processos" sobre o mesmo banco e o mesmo Redis.
    workerA = await criarModuloDeEventos(banco, redis);
    workerB = await criarModuloDeEventos(banco, redis);
    migrador = await banco.conectarComoMigrador();
    tenant = await criarTenant(await banco.conectarComoApp());
    for (const worker of [workerA, workerB]) {
      worker.get(RegistroDeConsumidores).registrar({
        nome: 'teste.skip-locked',
        evento: 'PagamentoConfirmado',
        fila: 'eventos',
        tratar: () => Promise.resolve(),
      });
    }
  });

  it('dois workers no mesmo lote: cada evento é entregue por um só (SKIP LOCKED)', async () => {
    const executor = workerA.get(ExecutorDeTenant);
    const publicador = workerA.get(PublicadorDeEventos);
    const publicados: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const evento = await executor.runAsTenant(tenant.id, () =>
        publicador.publicar(pagamentoConfirmado()),
      );
      publicados.push(evento.id);
    }

    // Cada um só segue depois que os dois reservaram o seu lote: sem SKIP LOCKED, o segundo ficaria
    // preso nas linhas travadas pelo primeiro e o teste não terminaria.
    const ambosReservaram = barreira(2);
    const [loteA, loteB] = await Promise.all([
      workerA.get(DespachanteDoOutbox).despacharLote({ limite: 5, aoReservar: ambosReservaram }),
      workerB.get(DespachanteDoOutbox).despacharLote({ limite: 5, aoReservar: ambosReservaram }),
    ]);

    expect(loteA).toHaveLength(5);
    expect(loteB).toHaveLength(5);
    expect(loteA.filter((id) => loteB.includes(id))).toEqual([]);
    expect([...loteA, ...loteB].sort()).toEqual([...publicados].sort());
    expect((await eventosNoOutbox(migrador, tenant.id)).every((e) => e.publicado)).toBe(true);
    expect(await workerA.get(FilasBullMQ).fila('eventos').getWaitingCount()).toBe(10);
  });
});
