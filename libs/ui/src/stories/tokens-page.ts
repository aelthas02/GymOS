import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import {
  AA_CONTRAST,
  accentPalette,
  contrastRatio,
  InvalidColorError,
} from '../../styles/contrast';
import { tokens, type TokenName } from '../../styles/tokens';
import { ThemeService } from '../lib/theme/theme.service';

const nomes = Object.keys(tokens) as TokenName[];
const ehCor = (nome: TokenName): boolean => tokens[nome].startsWith('#');

interface Exemplo {
  readonly rotulo: string;
  readonly contraste: string;
  readonly aa: boolean;
}

/** Página de tokens do Storybook: mostra o tema atual e o contraste de cada par do acento. */
@Component({
  selector: 'ui-tokens-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      padding: var(--page-padding);
      font-family: var(--font);
      color: var(--ink);
      background: var(--page);
    }
    h2 {
      margin: 32px 0 12px;
      font-size: 18px;
      font-weight: var(--font-weight-semibold);
    }
    .grade {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--gap);
    }
    .cartao {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      padding: var(--card-padding);
    }
    .amostra {
      height: 56px;
      border-radius: var(--radius-control);
      border: 1px solid var(--divider);
      margin-bottom: 8px;
    }
    .acento {
      background: var(--accent);
      color: var(--accent-contrast);
      border-radius: var(--radius-control);
      padding: 12px 16px;
      font-weight: var(--font-weight-semibold);
    }
    .tom {
      color: var(--accent-text);
      font-weight: var(--font-weight-semibold);
    }
    .pagina {
      background: var(--page);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--radius-pill);
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .muted {
      color: var(--muted);
      font-size: 13px;
    }
    .erro {
      color: var(--badge-late-fg);
    }
    code {
      font-size: 12px;
    }
  `,
  template: `
    <h1>Tokens do GymOS</h1>
    <p class="muted">
      Troque o acento na barra do Storybook (ou no controle desta história): os exemplos e o
      contraste acompanham.
    </p>

    <h2>Tema da academia</h2>
    @if (palette(); as tema) {
      <div class="grade">
        <div class="cartao">
          <div class="acento">Iniciar treino</div>
          <p class="muted">--accent {{ tema.accent }} · --accent-contrast {{ tema.contrast }}</p>
        </div>
        <div class="cartao">
          <p class="tom">Pagamento confirmado</p>
          <p class="muted">--accent-text {{ tema.text }} sobre --surface</p>
        </div>
        <div class="cartao pagina">
          <p class="tom">Pagamento confirmado</p>
          <p class="muted">--accent-text {{ tema.text }} sobre --page</p>
        </div>
      </div>
      <div class="grade">
        @for (exemplo of exemplos(); track exemplo.rotulo) {
          <p class="cartao">
            {{ exemplo.rotulo }}: <b>{{ exemplo.contraste }}:1</b>
            <span
              class="badge"
              [class.erro]="!exemplo.aa"
              [style.background]="exemplo.aa ? 'var(--badge-ok-bg)' : 'var(--badge-late-bg)'"
            >
              {{ exemplo.aa ? 'AA' : 'abaixo de AA' }}
            </span>
          </p>
        }
      </div>
    } @else {
      <p class="erro">Cor inválida: use #RGB ou #RRGGBB.</p>
    }

    <h2>Cores</h2>
    <div class="grade">
      @for (nome of cores; track nome) {
        <div class="cartao">
          <div class="amostra" [style.background]="'var(--' + nome + ')'"></div>
          <code>--{{ nome }}</code>
          <div class="muted">{{ valor(nome) }}</div>
        </div>
      }
    </div>

    <h2>Badges</h2>
    <div class="grade">
      @for (variante of badges; track variante) {
        <span
          class="badge"
          [style.background]="'var(--badge-' + variante + '-bg)'"
          [style.color]="'var(--badge-' + variante + '-fg)'"
        >
          badge-{{ variante }}
        </span>
      }
    </div>

    <h2>Tipografia (Inter)</h2>
    @for (peso of pesos; track peso) {
      <p [style.font-weight]="'var(--' + peso + ')'">
        {{ peso }} · {{ valor(peso) }} · Mensalidade de R$ 129,90 vence em 05/12
      </p>
    }

    <h2>Raios e layout</h2>
    <div class="grade">
      @for (nome of medidas; track nome) {
        <div class="cartao">
          <code>--{{ nome }}</code>
          <div class="muted">{{ valor(nome) }}</div>
        </div>
      }
    </div>
  `,
})
export class TokensPage {
  private readonly theme = inject(ThemeService);

  /** Acento a aplicar; vem da barra do Storybook ou do controle da história. */
  readonly accent = input.required<string>();

  protected readonly palette = computed(() => {
    try {
      return accentPalette(this.accent());
    } catch (erro) {
      if (erro instanceof InvalidColorError) {
        return null;
      }
      throw erro;
    }
  });

  protected readonly exemplos = computed<Exemplo[]>(() => {
    const tema = this.palette();
    if (tema === null) {
      return [];
    }
    return [
      exemplo('Texto sobre o acento', tema.accent, tema.contrast),
      exemplo('Tom do acento sobre --surface', tokens.surface, tema.text),
      exemplo('Tom do acento sobre --page', tokens.page, tema.text),
    ];
  });

  protected readonly cores = nomes.filter(
    (nome) => ehCor(nome) && !nome.startsWith('badge-') && !nome.startsWith('accent'),
  );
  protected readonly badges = ['ok', 'late', 'soon', 'off'] as const;
  protected readonly pesos = nomes.filter((nome) => nome.startsWith('font-weight-'));
  protected readonly medidas = nomes.filter((nome) => tokens[nome].endsWith('px'));

  constructor() {
    effect(() => {
      const tema = this.palette();
      if (tema !== null) {
        this.theme.setAccent(tema.accent);
      }
    });
  }

  protected valor(nome: TokenName): string {
    return tokens[nome];
  }
}

function exemplo(rotulo: string, fundo: string, texto: string): Exemplo {
  const razao = contrastRatio(fundo, texto);
  return { rotulo, contraste: razao.toFixed(2), aa: razao >= AA_CONTRAST };
}
