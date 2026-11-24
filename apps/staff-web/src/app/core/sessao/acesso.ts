import { computed, inject, Injectable, type Provider } from '@angular/core';
import {
  FEATURE_FLAGS,
  PERMISSION_CHECKER,
  type FeatureFlags,
  type PermissionChecker,
} from '@gymos/shared-forms';
import { AuthStore } from './auth.store';

/** Permissões `modulo:acao` do usuário logado, vindas de `GET /me`. */
@Injectable({ providedIn: 'root' })
export class PermissoesDoPerfil implements PermissionChecker {
  private readonly auth = inject(AuthStore);
  private readonly permissoes = computed(() => new Set(this.auth.perfil()?.permissoes ?? []));

  pode(permissao: string): boolean {
    return this.permissoes().has(permissao);
  }
}

/** Módulos extras ativos para a academia (`aulas`, `marketing`, `loja`, `saude`), de `GET /me`. */
@Injectable({ providedIn: 'root' })
export class ModulosDoPerfil implements FeatureFlags {
  private readonly auth = inject(AuthStore);
  private readonly modulos = computed(() => new Set<string>(this.auth.perfil()?.modulos ?? []));

  ativa(flag: string): boolean {
    return this.modulos().has(flag);
  }
}

export function provideAcesso(): Provider[] {
  return [
    { provide: PERMISSION_CHECKER, useExisting: PermissoesDoPerfil },
    { provide: FEATURE_FLAGS, useExisting: ModulosDoPerfil },
  ];
}
