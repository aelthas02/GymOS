import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button } from '../button/button';
import { stateStyles } from './state-styles';

/** Falha com saída: `error` (vermelho, como "Catraca offline") ou `warn` (amarelo, "Sem internet"). */
@Component({
  selector: 'ui-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  styles: stateStyles,
  template: `
    <div class="ui-state ui-state--{{ tone() }}" role="alert">
      <b class="ui-state__title">{{ heading() }}</b>
      @if (description()) {
        <span class="ui-state__description">{{ description() }}</span>
      }
      <div class="ui-state__actions">
        @if (retryable()) {
          <ui-button variant="outline" [loading]="retrying()" (click)="retry.emit()">
            {{ retryLabel() }}
          </ui-button>
        }
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
})
export class ErrorState {
  readonly heading = input.required<string>();
  readonly description = input<string>();
  readonly tone = input<'error' | 'warn'>('error');
  readonly retryable = input(true);
  readonly retryLabel = input('Tentar agora');
  /** Enquanto tenta de novo, o botão fica ocupado e ignora cliques. */
  readonly retrying = input(false);
  readonly retry = output<void>();
}
