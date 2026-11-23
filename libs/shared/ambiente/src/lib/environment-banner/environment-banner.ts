import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AppEnvironment, EnvironmentName } from '../app-environment';

const LABELS: Record<EnvironmentName, string> = {
  development: 'DEV',
  staging: 'STAGING',
  production: '',
};

/**
 * Selo discreto no topo da tela em dev e staging; nunca em produção. Fica por cima do layout
 * (sem empurrar o conteúdo) e não captura cliques.
 */
@Component({
  selector: 'gymos-environment-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label(); as label) {
      <div
        class="banner"
        role="note"
        [attr.aria-label]="'Ambiente de ' + environment().name"
        [attr.data-environment]="environment().name"
      >
        {{ label }}
      </div>
    }
  `,
  styles: `
    .banner {
      position: fixed;
      top: 0;
      left: 50%;
      z-index: 2147483647;
      transform: translateX(-50%);
      padding: 1px 10px;
      border-radius: 0 0 6px 6px;
      font:
        600 10px/16px system-ui,
        sans-serif;
      letter-spacing: 0.08em;
      color: #fff;
      background: #475569;
      opacity: 0.9;
      pointer-events: none;
    }
    .banner[data-environment='staging'] {
      background: #b45309;
    }
  `,
})
export class EnvironmentBanner {
  readonly environment = input.required<AppEnvironment>();

  protected readonly label = computed(() => {
    const environment = this.environment();
    return environment.production ? '' : LABELS[environment.name];
  });
}
