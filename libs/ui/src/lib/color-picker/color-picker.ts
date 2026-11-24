import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { hexToRgb, normalizeHex, rgbToHex, type HexColor } from '../../../styles/contrast';
import { tokens } from '../../../styles/tokens';

export type ColorPickerVariant = 'rgb-texto' | 'canais';

type Campo = 'hex' | 'rgb' | 'r' | 'g' | 'b';

/** "34, 201, 138" (ou com espaços e ponto e vírgula) em hex; `null` se não forem três inteiros de 0 a 255. */
export function rgbTextoParaHex(texto: string): HexColor | null {
  const partes = texto.trim().split(/[\s,;]+/);
  if (partes.length !== 3 || !partes.every((parte) => /^\d{1,3}$/.test(parte))) return null;

  const [r = 0, g = 0, b = 0] = partes.map(Number);
  return r > 255 || g > 255 || b > 255 ? null : rgbToHex({ r, g, b });
}

function hexValido(texto: string): HexColor | null {
  try {
    return normalizeHex(texto);
  } catch {
    return null;
  }
}

/**
 * Seletor de cor da academia: cores sugeridas, campo Hex e RGB. O valor só muda com uma cor
 * válida; enquanto o texto de um campo é inválido ele fica marcado e a cor anterior permanece.
 * `rgb-texto` mostra "34, 201, 138" num campo (Primeiros passos); `canais`, R, G e B (Configurações).
 */
@Component({
  selector: 'ui-color-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .ui-color__titulo {
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    .ui-color__linha {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 10px;
    }
    .ui-color__amostra {
      flex: none;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 0;
      border-radius: var(--radius-control);
      cursor: pointer;
    }
    .ui-color__amostra[aria-pressed='true'] {
      outline: 3px solid var(--ink);
      outline-offset: 2px;
    }
    .ui-color__amostra:focus-visible {
      outline: 3px solid var(--accent-text);
      outline-offset: 2px;
    }
    .ui-color__previa {
      flex: none;
      width: 40px;
      height: 40px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    input {
      box-sizing: border-box;
      width: 100%;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-regular) 14px var(--font);
    }
    input[aria-invalid='true'] {
      border-color: var(--badge-late-fg);
    }
    input:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 1px;
    }
    .ui-color__hex {
      width: 110px;
    }
    .ui-color__rgb {
      width: 150px;
    }
    .ui-color__canal {
      width: 72px;
    }
    .ui-color__canais {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .ui-color__canais label {
      flex: 1 1 0;
      font-size: 12px;
    }
    .ui-color__canais input,
    .ui-color__hex-canais input {
      height: 40px;
      text-align: center;
    }
    .ui-color__erro {
      margin-top: 6px;
      color: var(--badge-late-fg);
      font-size: 12px;
      font-weight: var(--font-weight-semibold);
    }
  `,
  template: `
    <div class="ui-color__titulo" [id]="tituloId">{{ label() }}</div>
    <div class="ui-color__linha" role="group" [attr.aria-labelledby]="tituloId">
      @for (cor of swatches(); track cor) {
        <button
          type="button"
          class="ui-color__amostra"
          [style.background-color]="cor"
          [attr.aria-label]="'Cor ' + cor"
          [attr.aria-pressed]="cor === valor()"
          (click)="escolher(cor)"
        ></button>
      }
      @if (variant() === 'rgb-texto') {
        <label class="ui-color__hex">
          Hex
          <input
            type="text"
            autocomplete="off"
            spellcheck="false"
            [value]="exibir('hex')"
            [attr.aria-invalid]="invalido('hex')"
            (input)="editar('hex', $event)"
            (blur)="reverter('hex')"
          />
        </label>
        <label class="ui-color__rgb">
          RGB
          <input
            type="text"
            autocomplete="off"
            inputmode="numeric"
            [value]="exibir('rgb')"
            [attr.aria-invalid]="invalido('rgb')"
            (input)="editar('rgb', $event)"
            (blur)="reverter('rgb')"
          />
        </label>
      } @else {
        <span class="ui-color__previa" aria-hidden="true" [style.background-color]="valor()"></span>
        <label class="ui-color__hex ui-color__hex-canais">
          Hex
          <input
            type="text"
            autocomplete="off"
            spellcheck="false"
            [value]="exibir('hex')"
            [attr.aria-invalid]="invalido('hex')"
            (input)="editar('hex', $event)"
            (blur)="reverter('hex')"
          />
        </label>
      }
    </div>
    @if (variant() === 'canais') {
      <div class="ui-color__canais">
        @for (canal of canais; track canal.campo) {
          <label>
            {{ canal.rotulo }}
            <input
              type="text"
              autocomplete="off"
              inputmode="numeric"
              [value]="exibir(canal.campo)"
              [attr.aria-invalid]="invalido(canal.campo)"
              (input)="editar(canal.campo, $event)"
              (blur)="reverter(canal.campo)"
            />
          </label>
        }
      </div>
    }
    @if (erro()) {
      <div class="ui-color__erro" role="alert">{{ erro() }}</div>
    }
  `,
})
export class ColorPicker {
  /** Cor atual em `#RRGGBB`. */
  readonly value = model<string>(tokens.accent);
  readonly swatches = input<readonly string[]>([]);
  readonly variant = input<ColorPickerVariant>('rgb-texto');
  readonly label = input('Cor principal');

  private static proximo = 0;
  protected readonly tituloId = `ui-color-${++ColorPicker.proximo}-titulo`;
  protected readonly canais = [
    { campo: 'r', rotulo: 'R' },
    { campo: 'g', rotulo: 'G' },
    { campo: 'b', rotulo: 'B' },
  ] as const;

  protected readonly valor = computed<HexColor>(() => hexValido(this.value()) ?? tokens.ink);
  private readonly rascunho = signal<Partial<Record<Campo, string>>>({});
  private readonly campoInvalido = signal<Campo | null>(null);
  protected readonly erro = computed(() =>
    this.campoInvalido() ? 'Cor inválida. Use um hex de seis dígitos ou valores de 0 a 255.' : null,
  );

  protected exibir(campo: Campo): string {
    const rascunho = this.rascunho()[campo];
    if (rascunho !== undefined) return rascunho;

    const cor = this.valor();
    const { r, g, b } = hexToRgb(cor);
    switch (campo) {
      case 'hex':
        return cor;
      case 'rgb':
        return `${r}, ${g}, ${b}`;
      case 'r':
        return String(r);
      case 'g':
        return String(g);
      default:
        return String(b);
    }
  }

  protected invalido(campo: Campo): 'true' | null {
    return this.campoInvalido() === campo ? 'true' : null;
  }

  protected escolher(cor: string): void {
    this.rascunho.set({});
    this.campoInvalido.set(null);
    const normalizada = hexValido(cor);
    if (normalizada) this.value.set(normalizada);
  }

  protected editar(campo: Campo, evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value;
    const cor = this.interpretar(campo, texto);

    if (cor) {
      this.rascunho.set({});
      this.campoInvalido.set(null);
      this.value.set(cor);
    } else {
      this.rascunho.set({ [campo]: texto });
      this.campoInvalido.set(campo);
    }
  }

  /** Ao sair de um campo inválido, volta ao texto da cor atual. */
  protected reverter(campo: Campo): void {
    if (this.campoInvalido() !== campo) return;

    this.rascunho.set({});
    this.campoInvalido.set(null);
  }

  private interpretar(campo: Campo, texto: string): HexColor | null {
    // Só os seis dígitos: aceitar "#abc" enquanto se digita reescreveria o campo no meio da digitação.
    if (campo === 'hex') return /^#?[0-9a-f]{6}$/i.test(texto.trim()) ? hexValido(texto) : null;
    if (campo === 'rgb') return rgbTextoParaHex(texto);

    if (!/^\d{1,3}$/.test(texto.trim()) || Number(texto) > 255) return null;
    const atual = hexToRgb(this.valor());
    return rgbToHex({ ...atual, [campo]: Number(texto) });
  }
}
