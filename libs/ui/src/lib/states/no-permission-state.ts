import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { stateStyles } from './state-styles';

/** Tela ou bloco que o perfil do usuário não pode abrir. */
@Component({
  selector: 'ui-no-permission-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  styles: stateStyles,
  template: `
    <div class="ui-state">
      <span class="ui-state__icon" aria-hidden="true"><ui-icon name="lock" [size]="24" /></span>
      <b class="ui-state__title">{{ heading() }}</b>
      <span class="ui-state__description">{{ description() }}</span>
      <div class="ui-state__actions"><ng-content select="[actions]" /></div>
    </div>
  `,
})
export class NoPermissionState {
  readonly heading = input('Você não tem acesso a esta área');
  readonly description = input('Peça a quem administra a academia para liberar essa permissão.');
}
