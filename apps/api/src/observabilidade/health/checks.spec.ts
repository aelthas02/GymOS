import { loadEnv } from '../../config/env';
import { readEnvExample } from '../../testing/test-app';
import { criarClientePrisma } from '../../modules/platform/infra/prisma/criar-cliente';
import { PostgresCheck } from './postgres.check';
import { RedisCheck } from './redis.check';

// Porta 1 (tcpmux) não tem serviço: a conexão é recusada, sem depender de Postgres/Redis reais.
const envSemServico = loadEnv({
  ...readEnvExample(),
  DATABASE_URL: 'postgresql://gymos:gymos@127.0.0.1:1/gymos',
  REDIS_URL: 'redis://127.0.0.1:1',
});

const prismaSemServico = criarClientePrisma(envSemServico.DATABASE_URL);

describe('verificações de prontidão sem serviço na porta', () => {
  afterAll(() => prismaSemServico.$disconnect());

  it('PostgresCheck rejeita quando não há Postgres', async () => {
    await expect(new PostgresCheck(prismaSemServico).check()).rejects.toThrow();
  }, 15_000);

  it('RedisCheck rejeita quando não há Redis', async () => {
    await expect(new RedisCheck(envSemServico).check()).rejects.toThrow();
  }, 15_000);

  it('têm os nomes usados no relatório do /health/ready', () => {
    expect(new PostgresCheck(prismaSemServico).name).toBe('postgres');
    expect(new RedisCheck(envSemServico).name).toBe('redis');
  });
});
