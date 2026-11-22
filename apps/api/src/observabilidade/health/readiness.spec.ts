import { runReadinessChecks, type ReadinessCheck } from './readiness';

function check(name: string, run: () => Promise<void>): ReadinessCheck {
  return { name, check: run };
}

describe('runReadinessChecks', () => {
  afterEach(() => vi.useRealTimers());

  it('marca a dependência como down quando a verificação passa do tempo limite', async () => {
    vi.useFakeTimers();
    const hanging = check('postgres', () => new Promise<void>(() => undefined));

    const result = runReadinessChecks([hanging], 2_000);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toEqual({ status: 'down', checks: { postgres: 'down' } });
  });

  it('roda as verificações em paralelo', async () => {
    vi.useFakeTimers();
    const slow = (name: string) =>
      check(name, () => new Promise<void>((resolve) => setTimeout(resolve, 1_500)));

    const result = runReadinessChecks([slow('postgres'), slow('redis')], 2_000);
    await vi.advanceTimersByTimeAsync(1_500);

    await expect(result).resolves.toEqual({
      status: 'up',
      checks: { postgres: 'up', redis: 'up' },
    });
  });

  it('passa a falha adiante para quem quiser registrar o motivo', async () => {
    const failure = new Error('fora do ar');
    const onFailure = vi.fn();

    await runReadinessChecks([check('redis', () => Promise.reject(failure))], 2_000, onFailure);

    expect(onFailure).toHaveBeenCalledWith('redis', failure);
  });
});
