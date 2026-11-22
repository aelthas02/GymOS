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
