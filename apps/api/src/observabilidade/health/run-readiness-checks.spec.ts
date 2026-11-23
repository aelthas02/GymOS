import { runReadinessChecks, type ReadinessCheck } from './readiness';

describe('runReadinessChecks', () => {
  afterEach(() => vi.useRealTimers());

  it('marca como down a dependência que não responde no prazo e avisa a falha', async () => {
    vi.useFakeTimers();
    const lenta: ReadinessCheck = {
      name: 'redis',
      check: () => new Promise<void>(() => undefined),
    };
    const ok: ReadinessCheck = { name: 'postgres', check: () => Promise.resolve() };
    const onFailure = vi.fn();

    const pending = runReadinessChecks([ok, lenta], 500, onFailure);
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toEqual({
      status: 'down',
      checks: { postgres: 'up', redis: 'down' },
    });
    expect(onFailure).toHaveBeenCalledWith(
      'redis',
      expect.objectContaining({ message: expect.stringContaining('500 ms') }),
    );
  });

  it('sem verificações o relatório é up', async () => {
    await expect(runReadinessChecks([], 100)).resolves.toEqual({ status: 'up', checks: {} });
  });
});
