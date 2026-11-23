import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { stateStyles } from './state-styles';

/** Lista vazia ou busca sem resultado. Ações no slot `[actions]`. */
@Component({
  selector: 'ui-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: stateStyles,
  template: `
    <div class="ui-state">
      @if (icon()) {
        <span class="ui-state__icon" aria-hidden="true"></span>
      }
      <b class="ui-state__title">{{ heading() }}</b>
      @if (description()) {
        <span class="ui-state__description">{{ description() }}</span>
      }
      <div class="ui-state__actions"><ng-content select="[actions]" /></div>
    </div>
  `,
})
export class EmptyState {
  readonly heading = input.required<string>();
  readonly description = input<string>();
  /** Círculo de destaque acima do título (lista vazia); a busca sem resultado não leva. */
  readonly icon = input(false);
}
