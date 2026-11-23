import { Controller, Get, Param } from '@nestjs/common';
import { createTestApp, type TestApp } from '../../testing/test-app';
import { QueueMetrics } from './metrics';

@Controller('alunos')
class AlunosDeTesteController {
  @Get('falha')
  falhar(): never {
    throw new Error('falha forçada');
  }

  @Get(':id')
  buscar(@Param('id') id: string): { id: string } {
    return { id };
  }
}

describe('métricas Prometheus', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp({ controllers: [AlunosDeTesteController] });
  });

  afterEach(() => app.close());

  async function scrape(): Promise<string> {
    const response = await app.get('/metrics');
    expect(response.status).toBe(200);
    return response.text();
  }

  it('responde no formato de texto do Prometheus, fora do prefixo /api', async () => {
    const response = await app.get('/metrics');

    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toContain('# TYPE http_request_duration_seconds histogram');
  });

  it('mede a latência pela rota do Nest, não pela URL com parâmetros', async () => {
    await app.get('/api/alunos/1');
    await app.get('/api/alunos/2');

    const metrics = await scrape();

    expect(metrics).toContain(
      'http_request_duration_seconds_count{method="GET",route="/api/alunos/:id",status_code="200"} 2',
    );
    expect(metrics).not.toContain('/api/alunos/1');
  });

  it('conta os erros de servidor por rota', async () => {
    await app.get('/api/alunos/falha');

    const metrics = await scrape();

    expect(metrics).toContain(
      'http_server_errors_total{method="GET",route="/api/alunos/falha",status_code="500"} 1',
    );
  });

  it('agrupa as requisições sem rota num rótulo só', async () => {
    await app.get('/api/nao-existe/abc');

    const metrics = await scrape();

    expect(metrics).toMatch(/route="<sem rota>",status_code="404"} 1/);
    expect(metrics).not.toContain('/api/nao-existe/abc');
  });

  it('expõe a contagem de jobs das filas registradas por estado', async () => {
    app.nest.get(QueueMetrics).register('emails', async () => ({ waiting: 3, failed: 1 }));

    const metrics = await scrape();

    expect(metrics).toContain('queue_jobs{queue="emails",state="waiting"} 3');
    expect(metrics).toContain('queue_jobs{queue="emails",state="failed"} 1');
  });

  it('inclui as métricas padrão do processo Node', async () => {
    expect(await scrape()).toContain('process_cpu_seconds_total');
  });
});

describe('métricas das filas', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(() => app.close());

  it('uma fila cuja leitura falha não derruba /metrics nem as outras filas', async () => {
    const queues = app.nest.get(QueueMetrics);
    queues.register('quebrada', () => Promise.reject(new Error('redis fora')));
    queues.register('emails', () => Promise.resolve({ waiting: 2 }));

    const response = await app.get('/metrics');
    const metrics = await response.text();

    expect(response.status).toBe(200);
    expect(metrics).toContain('queue_jobs{queue="emails",state="waiting"} 2');
    expect(metrics).not.toContain('queue="quebrada"');
  });

  it('a função devolvida por register remove a fila das coletas seguintes', async () => {
    const unregister = app.nest
      .get(QueueMetrics)
      .register('emails', () => Promise.resolve({ waiting: 5 }));
    const antes = await (await app.get('/metrics')).text();

    unregister();
    const depois = await (await app.get('/metrics')).text();

    expect(antes).toContain('queue_jobs{queue="emails",state="waiting"} 5');
    expect(depois).not.toContain('queue="emails"');
  });

  it('a contagem reflete o valor mais recente a cada coleta', async () => {
    let waiting = 1;
    app.nest.get(QueueMetrics).register('emails', () => Promise.resolve({ waiting }));

    await app.get('/metrics');
    waiting = 7;
    const metrics = await (await app.get('/metrics')).text();

    expect(metrics).toContain('queue_jobs{queue="emails",state="waiting"} 7');
  });
});
