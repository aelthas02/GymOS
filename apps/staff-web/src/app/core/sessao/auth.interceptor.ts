import {
  HttpErrorResponse,
  type HttpEvent,
  type HttpHandlerFn,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, type Observable, of, switchMap, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

/** Rotas da API que usam o token de acesso; login, refresh, convite e tenant público ficam de fora. */
function usaToken(url: string): boolean {
  const caminho = url.replace(/^https?:\/\/[^/]+/, '');
  return (
    caminho.startsWith('/api/') &&
    !caminho.startsWith('/api/auth/') &&
    !caminho.startsWith('/api/public/')
  );
}

function comToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Anexa o token e, no 401, renova pelo refresh uma única vez (as requisições em espera são
 * reenviadas com o token novo). Se o refresh falhar, encerra a sessão e vai para `/entrar`.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (!usaToken(req.url)) {
    return next(req);
  }
  const auth = inject(AuthStore);
  const usado = auth.accessToken();

  return next(comToken(req, usado)).pipe(
    catchError((erro: unknown) => {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401) {
        return throwError(() => erro);
      }
      // Outra requisição já renovou enquanto esta voltava: reenvia com o token atual.
      const atual = auth.accessToken();
      const novoToken = atual !== null && atual !== usado ? of(atual) : auth.renovar();
      return novoToken.pipe(
        catchError(() => auth.sessaoExpirada()),
        switchMap((token) => next(comToken(req, token))),
      );
    }),
  );
};
