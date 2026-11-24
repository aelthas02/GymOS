import type { Job } from 'bullmq';
import { JobSemTenantError } from '../../application/eventos';
import type { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { type EntregaDeEventos, JOB_DE_EVENTO } from '../eventos/entrega-de-eventos';
import type { ConexaoRedis } from './conexao-redis';
import { configuracaoDasFilas, type ConfiguracaoDasFilas } from './configuracao-das-filas';
import { FilasBullMQ } from './filas.bullmq';
import { ProcessadorDeFilas, TrabalhoDesconhecidoError } from './processador-de-filas';

const TENANT = '3f2b8c1e-7d4a-4b6e-9a10-5c2d8e7f1a90';

describe('FilasBullMQ (sem Redis)', () => {
  const filas = new FilasBullMQ({} as ConexaoRedis, {} as ConfiguracaoDasFilas);

  it.each([
    ['sem tenantId', {}],
    ['tenantId que não é UUID', { tenantId: 'academia-a' }],
    ['tenantId vazio', { tenantId: '' }],
  ])('enfileirar recusa dados %s', async (_nome, dados) => {
    await expect(filas.enfileirar('eventos', 'x', dados as never)).rejects.toBeInstanceOf(
      JobSemTenantError,
    );
  });

  it('enfileirarEmLote recusa o lote se um job não tiver tenant válido', async () => {
    await expect(
      filas.enfileirarEmLote('eventos', [
        { nome: 'a', id: '1', dados: { tenantId: TENANT } },
        { nome: 'b', id: '2', dados: { tenantId: 'x' } },
      ]),
    ).rejects.toBeInstanceOf(JobSemTenantError);
  });
});

describe('ProcessadorDeFilas (com dublês)', () => {
  const registrarFalha = vi.fn();
  const entregar = vi.fn();
  const runAsTenant = vi.fn((_tenant: string, fn: () => Promise<unknown>) => fn());
  const processador = new ProcessadorDeFilas(
    { registrarFalha } as unknown as FilasBullMQ,
    { entregar } as unknown as EntregaDeEventos,
    { runAsTenant } as unknown as ExecutorDeTenant,
  );

  const job = (nome: string, attemptsMade: number, attempts = 5): Job =>
    ({
      id: 'j1',
      name: nome,
      data: { tenantId: TENANT },
      attemptsMade,
      opts: { attempts },
    }) as unknown as Job;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('job de evento vai para a entrega', async () => {
    entregar.mockResolvedValue(true);

    await processador.processar('eventos', job(JOB_DE_EVENTO, 0));

    expect(entregar).toHaveBeenCalledOnce();
  });

  it('trabalho registrado roda em runAsTenant com os dados do job', async () => {
    const trabalho = vi.fn().mockResolvedValue(undefined);
    processador.registrarTrabalho('notas', 'emitir', trabalho);

    await processador.processar('notas', job('emitir', 0));

    expect(runAsTenant).toHaveBeenCalledWith(TENANT, expect.any(Function));
    expect(trabalho).toHaveBeenCalledOnce();
  });

  it('trabalho desconhecido falha e, na última tentativa, vai para a DLQ', async () => {
    await expect(processador.processar('notas', job('nao-existe', 4))).rejects.toBeInstanceOf(
      TrabalhoDesconhecidoError,
    );

    expect(registrarFalha).toHaveBeenCalledWith(
      'notas',
      expect.objectContaining({ name: 'nao-existe' }),
      'Nenhum trabalho nao-existe registrado na fila notas.',
    );
  });

  it('antes da última tentativa a falha não vai para a DLQ', async () => {
    entregar.mockRejectedValue(new Error('indisponível'));

    await expect(processador.processar('eventos', job(JOB_DE_EVENTO, 3))).rejects.toThrow(
      'indisponível',
    );

    expect(registrarFalha).not.toHaveBeenCalled();
  });

  it('na última tentativa, o motivo é a mensagem do erro (ou o texto, se não for Error)', async () => {
    entregar.mockRejectedValueOnce('texto solto');

    await expect(processador.processar('eventos', job(JOB_DE_EVENTO, 4))).rejects.toBe(
      'texto solto',
    );

    expect(registrarFalha).toHaveBeenCalledWith('eventos', expect.anything(), 'texto solto');
  });

  it('sem attempts nas opções, a primeira falha já é a última', async () => {
    entregar.mockRejectedValue(new Error('x'));
    const semOpcoes = { ...job(JOB_DE_EVENTO, 0), opts: {} } as unknown as Job;

    await expect(processador.processar('eventos', semOpcoes)).rejects.toThrow('x');

    expect(registrarFalha).toHaveBeenCalledOnce();
  });
});

describe('configuracaoDasFilas', () => {
  const env = (sobras: Record<string, unknown>) =>
    configuracaoDasFilas({
      REDIS_URL: 'redis://x:6379',
      REDIS_PREFIXO: 'gymos',
      FILAS_PROCESSAR: true,
      APP_ENV: 'development',
      ...sobras,
    } as never);

  it('copia URL, prefixo e processar do ambiente', () => {
    expect(env({ REDIS_PREFIXO: 'outro', FILAS_PROCESSAR: false })).toMatchObject({
      urlDoRedis: 'redis://x:6379',
      prefixo: 'outro',
      processar: false,
      tentativas: 5,
    });
  });

  it('o painel só existe fora de produção e onde os workers rodam', () => {
    expect(env({}).painel).toBe(true);
    expect(env({ APP_ENV: 'production' }).painel).toBe(false);
    expect(env({ FILAS_PROCESSAR: false }).painel).toBe(false);
  });
});
