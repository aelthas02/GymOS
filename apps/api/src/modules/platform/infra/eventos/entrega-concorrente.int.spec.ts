import type { INestApplicationContext } from '@nestjs/common';
import type { EventoDeDominio } from '@gymos/shared-events';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { type NomeDaFila, PublicadorDeEventos } from '../../application/eventos';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import {
  contarEfeitos,
  criarModuloDeEventos,
  eventosNoOutbox,
  pagamentoConfirmado,
} from '../../testing/eventos-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';
import { aguardar, usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { FilasBullMQ } from '../filas/filas.bullmq';
import { ProcessadorDeFilas } from '../filas/processador-de-filas';
import { DespachanteDoOutbox } from './despachante-do-outbox';
import { EntregaDeEventos, idDoJobDeEvento, JOB_DE_EVENTO } from './entrega-de-eventos';
import { RegistroDeConsumidores } from './registro-de-consumidores';

describe('entrega concorrente e reentrega de eventos', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;
  let app: Client;
  let migrador: Client;
  let tenant: TenantCriado;
  const tratados: Record<string, string[]> = {};

  /** Consumidor cujo efeito é criar uma unidade `efeito:<evento>`; `tratados` guarda os ids vistos. */
  function registrar(nome: string, fila: NomeDaFila = 'eventos'): void {
    tratados[nome] = [];
    const contexto = modulo.get(ContextoDoTenant);
    modulo.get(RegistroDeConsumidores).registrar({
      nome,
      evento: 'PagamentoConfirmado',
      fila,
      tratar: async (recebido) => {
        tratados[nome]?.push(recebido.id);
        // Dá tempo de a outra entrega chegar à marca enquanto esta ainda não confirmou.
        await new Promise((resolver) => setTimeout(resolver, 100));
        await contexto.cliente().unidade.create({
          data: { tenantId: recebido.tenantId, nome: `efeito:${recebido.id}` },
        });
      },
    });
  }

  function publicar(): Promise<EventoDeDominio<'PagamentoConfirmado'>> {
    return modulo
      .get(ExecutorDeTenant)
      .runAsTenant(tenant.id, () =>
        modulo.get(PublicadorDeEventos).publicar(pagamentoConfirmado()),
      );
  }

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis);
    app = await banco.conectarComoApp();
    migrador = await banco.conectarComoMigrador();
    tenant = await criarTenant(app);
  });

  it('duas entregas simultâneas do mesmo (consumidor, evento) têm o efeito uma vez', async () => {
    registrar('teste.concorrente');
    const evento = await publicar();
    const dados = { tenantId: tenant.id, consumidor: 'teste.concorrente', evento };
    const entrega = modulo.get(EntregaDeEventos);

    const resultados = await Promise.all([entrega.entregar(dados), entrega.entregar(dados)]);

    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(tratados['teste.concorrente']).toEqual([evento.id]);
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(1);
  });

  it('relay que reenfileira evento já processado, com outro id de job, é ignorado', async () => {
    registrar('teste.reentrega');
    const evento = await publicar();
    const dados = { tenantId: tenant.id, consumidor: 'teste.reentrega', evento };
    const entrega = modulo.get(EntregaDeEventos);
    expect(await entrega.entregar(dados)).toBe(true);

    const filas = modulo.get(FilasBullMQ);
    const novoId = `${idDoJobDeEvento('teste.reentrega', evento.id)}-de-novo`;
    await filas.enfileirar('eventos', JOB_DE_EVENTO, dados, { id: novoId });
    const job = (await filas.fila('eventos').getJob(novoId)) as Job;
    await modulo.get(ProcessadorDeFilas).processar('eventos', job);

    expect(tratados['teste.reentrega']).toEqual([evento.id]);
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(1);
  });

  it('dois consumidores do mesmo evento recebem cada um uma vez', async () => {
    registrar('teste.primeiro');
    registrar('teste.segundo', 'notas');
    const evento = await publicar();
    await modulo.get(DespachanteDoOutbox).despacharLote();

    const processador = modulo.get(ProcessadorDeFilas);
    const workers = [processador.iniciarWorker('eventos'), processador.iniciarWorker('notas')];
    try {
      await aguardar(
        () =>
          tratados['teste.primeiro']?.includes(evento.id) === true &&
          tratados['teste.segundo']?.includes(evento.id) === true,
        { descricao: 'os dois consumidores' },
      );
    } finally {
      await Promise.all(workers.map((worker) => worker.close()));
    }

    // O lote leva também os eventos pendentes dos testes anteriores; só o deste importa.
    const vezes = (nome: string) => tratados[nome]?.filter((id) => id === evento.id).length;
    expect(vezes('teste.primeiro')).toBe(1);
    expect(vezes('teste.segundo')).toBe(1);
    // Os consumidores dos testes anteriores também ouvem este tipo: um efeito por consumidor.
    const totalDeEntregas = Object.keys(tratados).reduce(
      (soma, nome) => soma + (vezes(nome) ?? 0),
      0,
    );
    expect(await contarEfeitos(app, tenant.id, evento.id)).toBe(totalDeEntregas);
  });

  it('evento sem consumidor é marcado como publicado, sem criar job', async () => {
    const evento = await modulo.get(ExecutorDeTenant).runAsTenant(tenant.id, () =>
      modulo.get(PublicadorDeEventos).publicar({
        tipo: 'CobrancaCriada',
        payload: {
          cobrancaId: randomUUID(),
          alunoId: randomUUID(),
          contratoId: null,
          valorEmCentavos: 100,
          vencimento: '2026-12-05',
        },
      }),
    );
    const filas = modulo.get(FilasBullMQ);
    const antes = await filas.fila('eventos').getJobCounts();

    const ids = await modulo.get(DespachanteDoOutbox).despacharLote();

    expect(ids).toContain(evento.id);
    const doOutbox = (await eventosNoOutbox(migrador, tenant.id)).find((e) => e.id === evento.id);
    expect(doOutbox?.publicado).toBe(true);
    expect(await filas.fila('eventos').getJobCounts()).toEqual(antes);
  });
});
