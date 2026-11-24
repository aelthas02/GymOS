import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { FEATURE_FLAGS, PERMISSION_CHECKER } from '@gymos/shared-forms';
import { map } from 'rxjs';
import { AuthStore } from './auth.store';

/** Rota só com sessão: recupera pelo refresh e, sem ela, vai para `/entrar`. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthStore)
    .restaurar()
    .pipe(map((ativa) => ativa || router.parseUrl('/entrar')));
};

/** `permissionGuard('alunos:ver')`: sem a permissão, mostra "sem permissão". */
export function permissionGuard(permissao: string): CanActivateFn {
  return () =>
    inject(PERMISSION_CHECKER).pode(permissao) || inject(Router).parseUrl('/sem-permissao');
}

/** `featureFlagGuard('loja')`: módulo desligado para a academia parece rota inexistente. */
export function featureFlagGuard(flag: string): CanActivateFn {
  return () => inject(FEATURE_FLAGS).ativa(flag) || inject(Router).parseUrl('/nao-encontrado');
}
