import { ErrorHandler, type Provider } from '@angular/core';
import * as Sentry from '@sentry/angular';
import type { AppEnvironment } from './app-environment';

// Definido no build pelo pipeline (sintaxe no README do pacote); sem ele, o evento vai sem release.
declare const GYMOS_RELEASE: string | undefined;

function buildRelease(): string | undefined {
  return typeof GYMOS_RELEASE === 'string' ? GYMOS_RELEASE : undefined;
}

/** Inicia o Sentry antes do bootstrap do app; sem `sentryDsn` não faz nada. */
export function initSentry(environment: AppEnvironment): void {
  if (!environment.sentryDsn) {
    return;
  }
  Sentry.init({
    dsn: environment.sentryDsn,
    environment: environment.name,
    release: buildRelease(),
    // Dados de aluno (LGPD): o evento não leva usuário, cookies, cabeçalhos, corpos nem query.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
  });
}

/** Troca o ErrorHandler do Angular pelo do Sentry quando o Sentry está ligado. */
export function provideSentry(environment: AppEnvironment): Provider[] {
  if (!environment.sentryDsn) {
    return [];
  }
  return [{ provide: ErrorHandler, useValue: Sentry.createErrorHandler() }];
}
