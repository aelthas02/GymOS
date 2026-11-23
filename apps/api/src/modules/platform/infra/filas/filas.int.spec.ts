import type { INestApplicationContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Filas, JobSemTenantError } from '../../application/eventos';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarModuloDeEventos } from '../../testing/eventos-de-teste';
import { usarRedisDeTeste } from '../../testing/redis-de-teste';
import { FilasBullMQ } from './filas.bullmq';

describe('filas por tipo', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis);
  });

  it('job sem tenantId é recusado ao enfileirar', async () => {
    const filas = modulo.get(Filas);

    await expect(
      filas.enfileirar('importacao', 'importar-alunos', { arquivo: 'alunos.csv' } as never),
    ).rejects.toThrow(JobSemTenantError);
    await expect(
      filas.enfileirar('importacao', 'importar-alunos', { tenantId: '', arquivo: 'alunos.csv' }),
    ).rejects.toThrow(JobSemTenantError);
    expect(await modulo.get(FilasBullMQ).fila('importacao').count()).toBe(0);

    await filas.enfileirar('importacao', 'importar-alunos', {
      tenantId: randomUUID(),
      arquivo: 'alunos.csv',
    });
    expect(await modulo.get(FilasBullMQ).fila('importacao').count()).toBe(1);
  });
});
