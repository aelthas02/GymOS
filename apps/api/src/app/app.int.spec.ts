import { Controller, Get, type INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { loadEnv } from '../config/env';
import { ENV } from '../config/env.module';
import { ContextoDoTenant } from '../modules/platform/infra/contexto/contexto-do-tenant';
import { usarBancoDeTeste } from '../modules/platform/testing/banco-de-teste';
import { criarTenant, criarUnidade, type TenantCriado } from '../modules/platform/testing/fabricas';
import { RedisCheck } from '../observabilidade/health/redis.check';
import { LOG_DESTINATION } from '../observabilidade/logging';
import { readEnvExample } from '../testing/test-app';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

@Controller('sonda')
class SondaController {
  private readonly logger = new Logger('Sonda');

  constructor(private readonly contexto: ContextoDoTenant) {}

  @Get()
  async sondar(): Promise<{ tenantId: string; unidades: number }> {
    const unidades = await this.contexto.cliente().unidade.count();
    this.logger.log('sonda dentro da transação');
    return { tenantId: this.contexto.tenant().id, unidades };
  }
}

// AppModule completo (observabilidade do T02 e plataforma do T11) contra o Postgres de teste.
describe('AppModule com observabilidade e multi-tenancy', () => {
  const banco = usarBancoDeTeste();
  const linhas: string[] = [];
  let app: INestApplication;
  let tenant: TenantCriado;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [SondaController],
    })
      .overrideProvider(ENV)
      .useValue(loadEnv({ ...readEnvExample(), DATABASE_URL: banco.urlApp, LOG_LEVEL: 'info' }))
      .overrideProvider(LOG_DESTINATION)
      .useValue({ write: (linha: string) => linhas.push(linha) })
      .overrideProvider(RedisCheck)
      .useValue({ name: 'redis', check: () => Promise.resolve() })
      .compile();
    app = modulo.createNestApplication({ bufferLogs: true });
    configureApp(app);
    await app.init();
    banco.aoFinal(() => app.close());

    const conexao = await banco.conectarComoApp();
    tenant = await criarTenant(conexao);
    await criarUnidade(conexao, tenant.id, 'Unidade Centro');
  });

  const logs = () => linhas.map((linha) => JSON.parse(linha) as Record<string, unknown>);

  it.each(['/health/live', '/health/ready', '/metrics'])(
    '%s responde sem tenant no Host',
    async (caminho) => {
      await request(app.getHttpServer()).get(caminho).set('Host', 'localhost:3000').expect(200);
    },
  );

  it('/health/ready consulta o Postgres pelo pool da API', async () => {
    const resposta = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(JSON.stringify(resposta.body)).toContain('postgres');
  });

  it('rota com tenant roda na transação e leva o correlationId aos logs', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/sonda')
      .set('Host', `${tenant.slug}.localhost:3000`)
      .set('x-correlation-id', 'corr-t11-sonda')
      .expect(200);

    expect(resposta.body).toEqual({ tenantId: tenant.id, unidades: 1 });
    expect(resposta.headers['x-correlation-id']).toBe('corr-t11-sonda');
    expect(logs()).toContainEqual(
      expect.objectContaining({
        msg: 'sonda dentro da transação',
        correlationId: 'corr-t11-sonda',
      }),
    );
  });

  it('tenant desconhecido responde 404 com o x-correlation-id', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/api/sonda')
      .set('Host', 'desconhecida.localhost:3000')
      .set('x-correlation-id', 'corr-t11-404')
      .expect(404);

    expect(resposta.headers['x-correlation-id']).toBe('corr-t11-404');
  });
});
