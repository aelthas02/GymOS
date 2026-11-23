import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import request from 'supertest';
import { AtualizarIdentidadeDoTenant } from '../../application/casos-de-uso';
import { CHAVE_DE_OPERACAO_DE_TESTE, criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import {
  comTenant,
  criarReferenciaExterna,
  criarTenant,
  criarUnidade,
  type TenantCriado,
} from '../../testing/fabricas';
import { CABECALHO_DA_CHAVE_DE_OPERACAO } from './interno.controller';

interface Identidade {
  nome: string;
  corDestaque: string;
  logotipoUrl: string | null;
}

describe('isolamento pela API HTTP', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let conexao: Client;
  let a: TenantCriado;
  let b: TenantCriado;

  const hostDe = (tenant: TenantCriado) => `${tenant.slug}.localhost:3000`;
  const publicoDe = async (tenant: TenantCriado) =>
    (
      await request(app.getHttpServer())
        .get('/api/public/tenant')
        .set('Host', hostDe(tenant))
        .expect(200)
    ).body as Identidade;
  const ultimoEventoDe = (tenantId: string, idExterno: string) =>
    comTenant(conexao, tenantId, async () => {
      const { rows } = await conexao.query<{ ultimo_evento: string | null }>(
        'SELECT ultimo_evento FROM referencia_externa WHERE id_externo = $1',
        [idExterno],
      );
      return rows[0]?.ultimo_evento;
    });

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao, { corDestaque: '#111111' });
    b = await criarTenant(conexao, { corDestaque: '#222222' });
    for (const [tenant, sufixo] of [
      [a, 'a'],
      [b, 'b'],
    ] as const) {
      await criarReferenciaExterna(conexao, tenant.id, {
        provedor: 'fake',
        idExterno: `ext-http-${sufixo}`,
        recurso: 'exemplo',
        recursoId: randomUUID(),
      });
    }
  });

  afterEach(() => vi.restoreAllMocks());

  describe('webhook sem slug', () => {
    it('processa no tenant dono do id externo e não toca no outro', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/fake')
        .send({ idExterno: 'ext-http-b', evento: 'pago' })
        .expect(200, { recebido: true });

      expect(await ultimoEventoDe(b.id, 'ext-http-b')).toBe('pago');
      expect(await ultimoEventoDe(a.id, 'ext-http-a')).toBeNull();
    });

    it('com id externo desconhecido responde 404', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/fake')
        .send({ idExterno: 'nao-existe', evento: 'pago' })
        .expect(404);
    });

    it('com corpo sem id externo responde 404', async () => {
      await request(app.getHttpServer()).post('/api/webhooks/fake').send({}).expect(404);
    });

    it('com provedor desconhecido responde 404', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/inexistente')
        .send({ idExterno: 'ext-http-a', evento: 'pago' })
        .expect(404);
    });
  });

  describe('PUT /api/tenant/identidade', () => {
    const corpoValido: Identidade = {
      nome: 'Nome novo',
      corDestaque: '#ABCDEF',
      logotipoUrl: null,
    };

    it('com o Host de A altera só A', async () => {
      const antesDeB = await publicoDe(b);

      await request(app.getHttpServer())
        .put('/api/tenant/identidade')
        .set('Host', hostDe(a))
        .send(corpoValido)
        .expect(200, corpoValido);

      expect(await publicoDe(a)).toEqual(corpoValido);
      expect(await publicoDe(b)).toEqual(antesDeB);
    });

    it.each([
      ['cor sem #', { ...corpoValido, corDestaque: 'ABCDEF' }],
      ['cor com 3 dígitos', { ...corpoValido, corDestaque: '#ABC' }],
      ['cor fora do hexadecimal', { ...corpoValido, corDestaque: '#GGGGGG' }],
      ['campo extra', { ...corpoValido, plano: 'premium' }],
      ['campo extra tenantId', { ...corpoValido, tenantId: randomUUID() }],
      ['nome vazio', { ...corpoValido, nome: '' }],
      ['nome com mais de 80 caracteres', { ...corpoValido, nome: 'x'.repeat(81) }],
      ['logotipo com protocolo javascript', { ...corpoValido, logotipoUrl: 'javascript:alert(1)' }],
      ['logotipo com protocolo ftp', { ...corpoValido, logotipoUrl: 'ftp://x.com/logo.png' }],
      ['logotipo com espaço', { ...corpoValido, logotipoUrl: 'http://x .com' }],
      ['corpo vazio', {}],
    ])('com %s responde 400 e não altera nada', async (_descricao, corpo) => {
      const antesDeA = await publicoDe(a);
      const antesDeB = await publicoDe(b);

      await request(app.getHttpServer())
        .put('/api/tenant/identidade')
        .set('Host', hostDe(b))
        .send(corpo)
        .expect(400);

      expect(await publicoDe(a)).toEqual(antesDeA);
      expect(await publicoDe(b)).toEqual(antesDeB);
    });

    it('com Host de academia desconhecida responde 404 e não altera ninguém', async () => {
      const antesDeA = await publicoDe(a);

      await request(app.getHttpServer())
        .put('/api/tenant/identidade')
        .set('Host', 'fantasma.localhost:3000')
        .send(corpoValido)
        .expect(404);

      expect(await publicoDe(a)).toEqual(antesDeA);
    });

    it('erro depois do UPDATE dentro do handler desfaz a transação', async () => {
      const antes = await publicoDe(b);
      const caso = app.get(AtualizarIdentidadeDoTenant);
      const real = caso.executar.bind(caso);
      vi.spyOn(caso, 'executar').mockImplementation(async (identidade) => {
        await real(identidade);
        throw new Error('falha depois de gravar');
      });

      await request(app.getHttpServer())
        .put('/api/tenant/identidade')
        .set('Host', hostDe(b))
        .send({ nome: 'Nao deve ficar', corDestaque: '#000000', logotipoUrl: null })
        .expect(500);

      expect(await publicoDe(b)).toEqual(antes);
    });
  });

  describe('POST /api/interno/academias', () => {
    const corpo = (slug: string) => ({
      slug,
      nome: 'Academia Nova',
      adminEmail: 'dono@exemplo.com',
    });
    const criar = (slug: string, chave?: string) => {
      const req = request(app.getHttpServer()).post('/api/interno/academias');
      return (chave ? req.set(CABECALHO_DA_CHAVE_DE_OPERACAO, chave) : req).send(corpo(slug));
    };

    it('sem chave responde 401', async () => {
      await criar('sem-chave').expect(401);
    });

    it('com chave errada responde 401', async () => {
      await criar('chave-errada', 'chave-errada').expect(401);
    });

    it('com chave de tamanho diferente responde 401', async () => {
      await criar('chave-curta', 'x').expect(401);
    });

    it('sem chave configurada o endpoint não existe (404), mesmo com cabeçalho', async () => {
      const semChave = await criarAppDeTeste(banco, { chaveDeOperacao: undefined });

      await request(semChave.getHttpServer())
        .post('/api/interno/academias')
        .set(CABECALHO_DA_CHAVE_DE_OPERACAO, CHAVE_DE_OPERACAO_DE_TESTE)
        .send(corpo('sem-config'))
        .expect(404);
    });

    it('slug reservado responde 400', async () => {
      await criar('api', CHAVE_DE_OPERACAO_DE_TESTE).expect(400);
    });

    it('slug fora do formato responde 400', async () => {
      await criar('Maiuscula', CHAVE_DE_OPERACAO_DE_TESTE).expect(400);
    });

    it('cria tenant e unidade visíveis só no tenant novo; slug repetido responde 409', async () => {
      const resposta = await criar('nova-academia', CHAVE_DE_OPERACAO_DE_TESTE).expect(201);
      const { tenantId, unidadeId } = resposta.body as { tenantId: string; unidadeId: string };

      const publico = await request(app.getHttpServer())
        .get('/api/public/tenant')
        .set('Host', 'nova-academia.localhost:3000')
        .expect(200);
      expect(publico.body).toMatchObject({ nome: 'Academia Nova' });
      const doNovo = await comTenant(conexao, tenantId, () =>
        conexao.query<{ id: string }>('SELECT id FROM unidade'),
      );
      expect(doNovo.rows.map((row) => row.id)).toEqual([unidadeId]);
      await criarUnidade(conexao, a.id, 'Unidade de A');
      const deA = await comTenant(conexao, a.id, () =>
        conexao.query<{ id: string }>('SELECT id FROM unidade'),
      );
      expect(deA.rows.map((row) => row.id)).not.toContain(unidadeId);

      await criar('nova-academia', CHAVE_DE_OPERACAO_DE_TESTE).expect(409);
    });
  });
});
