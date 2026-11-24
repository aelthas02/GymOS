import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FEATURE_FLAGS, PERMISSION_CHECKER } from '@gymos/shared-forms';
import { AppShell } from '@gymos/ui';
import { AuthStore } from '../sessao/auth.store';
import { montarMenu } from './menu';

/** Moldura do painel: menu lateral filtrado pelo perfil e a tela da rota no conteúdo. */
@Component({
  selector: 'app-shell-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppShell, RouterOutlet],
  template: `<ui-app-shell [sections]="secoes()"><router-outlet /></ui-app-shell>`,
})
export class ShellPage {
  private readonly auth = inject(AuthStore);
  private readonly permissoes = inject(PERMISSION_CHECKER);
  private readonly flags = inject(FEATURE_FLAGS);

  protected readonly secoes = computed(() => {
    this.auth.perfil();
    return montarMenu(
      (permissao) => this.permissoes.pode(permissao),
      (modulo) => this.flags.ativa(modulo),
    );
  });
}
