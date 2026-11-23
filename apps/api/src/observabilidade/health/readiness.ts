/** Uma dependência que a API precisa para atender: rejeita quando não está disponível. */
export interface ReadinessCheck {
  readonly name: string;
  check(): Promise<void>;
}

export type DependencyStatus = 'up' | 'down';

export interface ReadinessReport {
  status: DependencyStatus;
  checks: Record<string, DependencyStatus>;
}

export const READINESS_TIMEOUT_MS = 2_000;

function withTimeout(run: () => Promise<void>, timeoutMs: number, name: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${name} não respondeu em ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  return Promise.race([run(), timeout]).finally(() => clearTimeout(timer));
}

/** Roda as verificações em paralelo; a API está pronta só se todas responderem no prazo. */
export async function runReadinessChecks(
  checks: readonly ReadinessCheck[],
  timeoutMs: number,
  onFailure?: (name: string, error: unknown) => void,
): Promise<ReadinessReport> {
  const results = await Promise.all(
    checks.map(async (dependency): Promise<[string, DependencyStatus]> => {
      try {
        await withTimeout(() => dependency.check(), timeoutMs, dependency.name);
        return [dependency.name, 'up'];
      } catch (error) {
        onFailure?.(dependency.name, error);
        return [dependency.name, 'down'];
      }
    }),
  );
  return {
    status: results.every(([, status]) => status === 'up') ? 'up' : 'down',
    checks: Object.fromEntries(results),
  };
}
