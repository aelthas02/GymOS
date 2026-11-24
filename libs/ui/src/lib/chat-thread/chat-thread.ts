import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ChatMessage {
  readonly id: string;
  /** `enviada` é da academia (à direita, na cor de destaque); `recebida` é do aluno. */
  readonly direction: 'enviada' | 'recebida';
  readonly text: string;
  /** Linha pequena abaixo da bolha ("Enviada hoje, 09h10, pela recepção"). */
  readonly meta: string;
}

export interface ChatQuickAction {
  readonly id: string;
  readonly label: string;
}

/**
 * Conversa em bolhas, com metadados de cada mensagem e ações rápidas abaixo (modelos de resposta).
 * É só a conversa: cabeçalho, campo de escrita e envio ficam com a tela.
 */
@Component({
  selector: 'ui-chat-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .ui-chat__mensagens {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 300px;
      margin: 0;
      padding: 18px;
      background: color-mix(in srgb, var(--page) 55%, var(--surface));
      list-style: none;
    }
    .ui-chat__mensagem {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .ui-chat__mensagem--enviada {
      align-items: flex-end;
    }
    .ui-chat__mensagem--recebida {
      align-items: flex-start;
    }
    .ui-chat__bolha {
      box-sizing: border-box;
      max-width: 78%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .ui-chat__mensagem--enviada .ui-chat__bolha {
      background: var(--accent);
      color: var(--accent-contrast);
    }
    .ui-chat__mensagem--recebida .ui-chat__bolha {
      border: 1px solid var(--border);
      background: var(--surface);
    }
    .ui-chat__meta {
      color: var(--muted);
      font-size: 11px;
    }
    .ui-chat__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 18px;
      border-top: 1px solid var(--divider);
    }
    .ui-chat__acao {
      min-height: 36px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 12px var(--font);
      cursor: pointer;
    }
    .ui-chat__acao:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
  `,
  template: `
    <div role="log" aria-live="polite" [attr.aria-label]="label()">
      <ul class="ui-chat__mensagens">
        @for (mensagem of messages(); track mensagem.id) {
          <li class="ui-chat__mensagem" [class]="'ui-chat__mensagem--' + mensagem.direction">
            <div class="ui-chat__bolha">{{ mensagem.text }}</div>
            <span class="ui-chat__meta">{{ mensagem.meta }}</span>
          </li>
        }
      </ul>
    </div>
    @if (quickActions().length > 0) {
      <div class="ui-chat__acoes" role="group" aria-label="Ações rápidas">
        @for (acao of quickActions(); track acao.id) {
          <button type="button" class="ui-chat__acao" (click)="quickAction.emit(acao)">
            {{ acao.label }}
          </button>
        }
      </div>
    }
  `,
})
export class ChatThread {
  readonly messages = input.required<readonly ChatMessage[]>();
  readonly quickActions = input<readonly ChatQuickAction[]>([]);
  readonly label = input('Conversa');

  readonly quickAction = output<ChatQuickAction>();
}
