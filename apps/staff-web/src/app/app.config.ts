import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { correlationIdInterceptor, provideSentry } from '@gymos/shared-ambiente';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';
import { provideAcesso } from './core/sessao/acesso';
import { authInterceptor } from './core/sessao/auth.interceptor';
import { TenantStore } from './core/tenant/tenant.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptors([correlationIdInterceptor, authInterceptor])),
    ...provideSentry(environment),
    ...provideAcesso(),
    // Identidade e tema da academia antes da primeira tela (Entrar já aparece com a cor dela).
    provideAppInitializer(() => inject(TenantStore).carregar()),
  ],
};
