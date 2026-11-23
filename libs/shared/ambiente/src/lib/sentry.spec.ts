import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as Sentry from '@sentry/angular';
import type { AppEnvironment } from './app-environment';
import { initSentry, provideSentry } from './sentry';

vi.mock('@sentry/angular', () => ({
  init: vi.fn(),
  createErrorHandler: vi.fn(() => ({ handleError: vi.fn() })),
}));

const DSN = 'https://chave-publica@sentry.invalid/2';

function environment(overrides: Partial<AppEnvironment>): AppEnvironment {
  return { name: 'development', production: false, sentryDsn: '', ...overrides };
}

describe('Sentry no front', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('não inicia o Sentry quando a DSN não está definida', () => {
    initSentry(environment({ sentryDsn: '' }));

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('inicia com o nome do ambiente e o release gravado no build', () => {
    vi.stubGlobal('GYMOS_RELEASE', 'staff-web@1.4.0');

    initSentry(environment({ name: 'staging', sentryDsn: DSN }));

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: DSN,
        environment: 'staging',
        release: 'staff-web@1.4.0',
        dataCollection: expect.objectContaining({
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
        }),
      }),
    );
  });

  it('inicia sem release quando o build não definiu GYMOS_RELEASE', () => {
    initSentry(environment({ name: 'production', production: true, sentryDsn: DSN }));

    expect(vi.mocked(Sentry.init).mock.calls[0]?.[0]).toMatchObject({ release: undefined });
  });

  it('mantém o ErrorHandler do Angular quando a DSN não está definida', () => {
    expect(provideSentry(environment({ sentryDsn: '' }))).toEqual([]);
  });

  it('troca o ErrorHandler do Angular pelo do Sentry quando a DSN está definida', () => {
    TestBed.configureTestingModule({ providers: provideSentry(environment({ sentryDsn: DSN })) });

    expect(TestBed.inject(ErrorHandler)).toBe(
      vi.mocked(Sentry.createErrorHandler).mock.results[0]?.value,
    );
  });
});
