import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import request from 'supertest';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { comTenant, criarReferenciaExterna, criarTenant } from '../../testing/fabricas';

describe('webhooks por tenant', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let tenantB: string;
  let slugB: string;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    conexao = await banco.conectarComoApp();
    await criarTenant(conexao, { slug: 'ritmo', nome: 'Academia Ritmo' });
    ({ id: tenantB, slug: slugB } = await criarTenant(conexao));
    await criarReferenciaExterna(conexao, tenantB, {
      provedor: 'fake',
      idExterno: 'ext-b',
      recurso: 'exemplo',
      recursoId: randomUUID(),
    });
  });

  const ultimoEventoDeB = () =>
    comTenant(conexao, tenantB, async () => {
      const { rows } = await conexao.query<{ ultimo_evento: string | null }>(
        "SELECT ultimo_evento FROM referencia_externa WHERE id_externo = 'ext-b'",
      );
      return rows[0]?.ultimo_evento;
    });

  it('em /webhooks/fake/ritmo com o id externo de um recurso de B responde 404 e não altera nada', async () => {
    await request(app.getHttpServer())
      .post('/api/webhooks/fake/ritmo')
      .send({ idExterno: 'ext-b', evento: 'pago' })
      .expect(404);

    expect(await ultimoEventoDeB()).toBeNull();
  });

  it('no slug do dono, o mesmo evento é processado', async () => {
    await request(app.getHttpServer())
      .post(`/api/webhooks/fake/${slugB}`)
      .send({ idExterno: 'ext-b', evento: 'pago' })
      .expect(200);

    expect(await ultimoEventoDeB()).toBe('pago');
  });
});
