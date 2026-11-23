import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconButton } from '../icon-button/icon-button';
import { ToastService } from './toast.service';

/** Lugar dos avisos na tela: uma vez por app, perto da raiz. A região `aria-live` está sempre no DOM. */
@Component({
  selector: 'ui-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButton],
  styles: `
    .ui-toast-outlet {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 200;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(360px, calc(100vw - 32px));
    }
    .ui-toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 8px 8px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--ink);
      color: var(--on-ink);
      font-size: 14px;
    }
    .ui-toast--success {
      border-color: var(--badge-ok-fg);
    }
    .ui-toast--error {
      border-color: var(--state-error-border);
    }
  `,
  template: `
    <div class="ui-toast-outlet" aria-live="polite">
      @for (toast of servico.visible(); track toast.id) {
        <div
          class="ui-toast ui-toast--{{ toast.tone }}"
          [attr.role]="toast.tone === 'error' ? 'alert' : 'status'"
        >
          <span class="ui-toast__message">{{ toast.message }}</span>
          <ui-icon-button icon="close" label="Fechar aviso" (click)="servico.dismiss(toast.id)" />
        </div>
      }
    </div>
  `,
})
export class ToastOutlet {
  protected readonly servico = inject(ToastService);
}
