import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FormatarValor } from './escala';

/** Barra de progresso (meta da semana, ocupação). O rótulo é obrigatório: é o nome para o leitor de tela. */
@Component({
  selector: 'ui-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .ui-progresso {
      height: 8px;
      overflow: hidden;
      border-radius: var(--radius-pill);
      background: var(--divider);
    }
    .ui-progresso__fill {
      height: 100%;
      border-radius: var(--radius-pill);
      background: var(--accent);
    }
  `,
  template: `
    <div
      class="ui-progresso"
      role="progressbar"
      aria-valuemin="0"
      [attr.aria-valuemax]="max()"
      [attr.aria-valuenow]="atual()"
      [attr.aria-valuetext]="texto()"
      [attr.aria-label]="rotulo()"
    >
      <div class="ui-progresso__fill" [style.width.%]="percentual()"></div>
    </div>
  `,
})
export class ProgressBar {
  readonly valor = input.required<number>();
  readonly max = input(100);
  readonly rotulo = input.required<string>();
  /** Texto lido no lugar do número ("3 de 4 treinos"); sem ele vale o valor puro. */
  readonly formatar = input<FormatarValor>();

  protected readonly atual = computed(() => {
    const valor = this.valor();
    const max = this.max();
    return Number.isFinite(valor) && max > 0 ? Math.min(max, Math.max(0, valor)) : 0;
  });

  protected readonly percentual = computed(() =>
    this.max() > 0 ? Number(((this.atual() / this.max()) * 100).toFixed(2)) : 0,
  );

  protected readonly texto = computed(() => this.formatar()?.(this.atual()) ?? null);
}
