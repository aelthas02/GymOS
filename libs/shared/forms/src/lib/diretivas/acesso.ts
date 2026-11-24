import {
  Directive,
  effect,
  inject,
  InjectionToken,
  input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

/**
 * Consulta de permissão do usuário logado. A implementação real vem do T14; ler sinais dentro de
 * `pode` faz a diretiva reagir quando as permissões mudam.
 */
export interface PermissionChecker {
  /** `permissao` no formato `recurso:acao` (`alunos:excluir`). */
  pode(permissao: string): boolean;
}

/** Consulta das flags de módulo do tenant. A implementação real vem do T32. */
export interface FeatureFlags {
  ativa(flag: string): boolean;
}

/** Sem implementação registrada, ninguém tem permissão (o back também verifica). */
export const PERMISSION_CHECKER = new InjectionToken<PermissionChecker>('PERMISSION_CHECKER', {
  factory: () => ({ pode: () => false }),
});

/** Sem implementação registrada, todas as flags ficam desligadas. */
export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS', {
  factory: () => ({ ativa: () => false }),
});

/** Cria a view do template só enquanto `visivel` retorna verdadeiro. */
function mostrarSe(
  visivel: () => boolean,
  modelo: TemplateRef<unknown>,
  contêiner: ViewContainerRef,
): void {
  effect(() => {
    const mostrar = visivel();
    if (mostrar && contêiner.length === 0) {
      contêiner.createEmbeddedView(modelo);
    } else if (!mostrar) {
      contêiner.clear();
    }
  });
}

/**
 * Esconde o elemento sem a permissão (ele sai do DOM, não só fica desabilitado):
 * `<button *appPermission="'alunos:excluir'">Excluir</button>`.
 */
@Directive({ selector: '[appPermission]' })
export class Permission {
  readonly appPermission = input.required<string>();

  constructor() {
    const checker = inject(PERMISSION_CHECKER);
    mostrarSe(
      () => checker.pode(this.appPermission()),
      inject(TemplateRef),
      inject(ViewContainerRef),
    );
  }
}

/** Esconde o elemento quando o módulo está desligado para a academia: `*appFeatureFlag="'loja'"`. */
@Directive({ selector: '[appFeatureFlag]' })
export class FeatureFlag {
  readonly appFeatureFlag = input.required<string>();

  constructor() {
    const flags = inject(FEATURE_FLAGS);
    mostrarSe(
      () => flags.ativa(this.appFeatureFlag()),
      inject(TemplateRef),
      inject(ViewContainerRef),
    );
  }
}
