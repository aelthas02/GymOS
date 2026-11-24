import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { accentContrast, normalizeHex } from '../../../styles/contrast';

/** Prévia do app do aluno: barra com o nome da academia e o cartão do treino do dia. */
export interface AppPreview {
  readonly kind: 'app';
  readonly appName: string;
  readonly greeting: string;
  readonly highlightLabel: string;
  readonly highlight: string;
  readonly primaryAction: string;
  readonly secondaryAction: string;
}

/** Prévia de uma mensagem no WhatsApp. */
export interface WhatsappPreview {
  readonly kind: 'whatsapp';
  readonly message: string;
  readonly time: string;
}

/** Prévia de uma publicação no feed. */
export interface PostPreview {
  readonly kind: 'post';
  readonly account: string;
  readonly headline: string;
  readonly subline?: string;
  readonly caption: string;
}

export type PhonePreviewData = AppPreview | WhatsappPreview | PostPreview;

/**
 * Moldura de prévia de como o aluno vê o app, a mensagem do WhatsApp ou o post. `accent` troca a
 * cor de destaque só dentro da prévia, para mostrar a cor que ainda está sendo escolhida.
 */
@Component({
  selector: 'ui-phone-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--preview-accent]': 'cor().accent',
    '[style.--preview-contrast]': 'cor().contraste',
  },
  styles: `
    :host {
      display: block;
    }
    .ui-preview {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 14px;
    }
    .ui-preview--app {
      background: var(--page);
    }
    .ui-preview--post {
      max-width: 300px;
      margin: 0 auto;
      background: var(--surface);
    }
    .ui-preview--whatsapp {
      padding: 18px;
      border: 0;
      background: var(--whatsapp-bg);
    }
    .ui-app__barra {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 16px;
      background: var(--preview-accent);
      color: var(--preview-contrast);
      font-weight: var(--font-weight-bold);
    }
    .ui-app__corpo {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
    }
    .ui-app__cartao {
      padding: 12px;
      border-radius: var(--radius-control);
      background: var(--surface);
      font-size: 13px;
    }
    .ui-app__acoes {
      display: flex;
      gap: 8px;
    }
    .ui-app__acao {
      padding: 10px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      font-size: 13px;
    }
    .ui-app__acao--primaria {
      border-color: transparent;
      background: var(--preview-accent);
      color: var(--preview-contrast);
      font-weight: var(--font-weight-semibold);
    }
    .ui-wa__bolha {
      box-sizing: border-box;
      max-width: 260px;
      padding: 12px 14px;
      border-radius: 12px 12px 12px 2px;
      background: var(--surface);
      font-size: 14px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .ui-wa__hora {
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
      text-align: right;
    }
    .ui-post__conta {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .ui-post__avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: var(--preview-accent);
    }
    .ui-post__arte {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      height: 240px;
      padding: 16px;
      background: linear-gradient(135deg, var(--preview-accent), var(--accent-text));
      color: var(--preview-contrast);
      text-align: center;
    }
    .ui-post__titulo {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.2;
    }
    .ui-post__sub {
      margin-top: 8px;
      font-size: 14px;
    }
    .ui-post__legenda {
      padding: 10px 12px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.5;
    }
  `,
  template: `
    @let dados = preview();
    @switch (dados.kind) {
      @case ('app') {
        <div class="ui-preview ui-preview--app" role="img" [attr.aria-label]="descricao()">
          <div class="ui-app__barra">
            <span>{{ dados.appName }}</span>
            <span>{{ dados.greeting }}</span>
          </div>
          <div class="ui-app__corpo">
            <div class="ui-app__cartao">
              {{ dados.highlightLabel }} <b>{{ dados.highlight }}</b>
            </div>
            <div class="ui-app__acoes">
              <span class="ui-app__acao ui-app__acao--primaria">{{ dados.primaryAction }}</span>
              <span class="ui-app__acao">{{ dados.secondaryAction }}</span>
            </div>
          </div>
        </div>
      }
      @case ('whatsapp') {
        <div class="ui-preview ui-preview--whatsapp">
          <div class="ui-wa__bolha">
            {{ dados.message }}
            <div class="ui-wa__hora">{{ dados.time }}</div>
          </div>
        </div>
      }
      @case ('post') {
        <div class="ui-preview ui-preview--post">
          <div class="ui-post__conta">
            <span class="ui-post__avatar" aria-hidden="true"></span>{{ dados.account }}
          </div>
          <div class="ui-post__arte">
            <div class="ui-post__titulo">{{ dados.headline }}</div>
            @if (dados.subline) {
              <div class="ui-post__sub">{{ dados.subline }}</div>
            }
          </div>
          <div class="ui-post__legenda">{{ dados.caption }}</div>
        </div>
      }
    }
  `,
})
export class PhonePreview {
  readonly preview = input.required<PhonePreviewData>();
  /** Cor de destaque da prévia; sem ela, usa a do tema. */
  readonly accent = input<string>();

  protected readonly cor = computed(() => {
    const informada = this.accent();
    if (!informada) return { accent: 'var(--accent)', contraste: 'var(--accent-contrast)' };

    try {
      const accent = normalizeHex(informada);
      return { accent, contraste: accentContrast(accent) };
    } catch {
      return { accent: 'var(--accent)', contraste: 'var(--accent-contrast)' };
    }
  });

  protected readonly descricao = computed(() => {
    const dados = this.preview();
    return dados.kind === 'app'
      ? `Prévia do app: ${dados.appName}, ${dados.greeting}. ${dados.highlightLabel} ${dados.highlight}.`
      : '';
  });
}
