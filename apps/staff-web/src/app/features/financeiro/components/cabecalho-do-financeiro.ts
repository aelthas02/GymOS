import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Button, PageHeader, Tabs } from '@gymos/ui';
import { VISOES_DO_FINANCEIRO } from '../utils/financeiro';

/**
 * Cabeçalho comum das telas do Financeiro: título, "Ver relatório financeiro", ajuda e o seletor
 * "Visualizar por". Os botões extras da tela entram no slot `[acoes]`.
 */
@Component({
  selector: 'app-cabecalho-do-financeiro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Tabs, Button],
  styles: `
    :host {
      display: contents;
    }
    .cabecalho__visualizar {
      margin-bottom: -8px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
  `,
  template: `
    <ui-page-header heading="Financeiro" [subtitle]="subtitulo()" (helpClick)="ajuda.emit()">
      <div actions>
        <ng-content select="[acoes]" />
        <ui-button (click)="relatorio.emit()">Ver relatório financeiro</ui-button>
      </div>
    </ui-page-header>

    <div class="cabecalho__visualizar" id="visualizar-por">Visualizar por</div>
    <div data-tutorial="abas">
      <ui-tabs [items]="visoes" label="Visualizar por" />
    </div>
  `,
})
export class CabecalhoDoFinanceiro {
  readonly subtitulo = input.required<string>();
  readonly ajuda = output<void>();
  readonly relatorio = output<void>();

  protected readonly visoes = VISOES_DO_FINANCEIRO;
}
