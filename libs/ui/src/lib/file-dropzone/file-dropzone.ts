import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

type ArquivoMinimo = Pick<File, 'name' | 'type' | 'size'>;

/** Motivo da rejeição de um arquivo, ou `null` quando ele é aceito. */
export function validarArquivo(
  arquivo: ArquivoMinimo,
  aceitos: readonly string[],
  tamanhoMaximo?: number,
): string | null {
  if (aceitos.length > 0 && !aceitos.some((regra) => combina(arquivo, regra))) {
    return `Formato não aceito. Envie ${listar(aceitos)}.`;
  }

  if (tamanhoMaximo !== undefined && arquivo.size > tamanhoMaximo) {
    return `O arquivo passa de ${formatarTamanho(tamanhoMaximo)}.`;
  }

  return null;
}

function combina(arquivo: ArquivoMinimo, regra: string): boolean {
  const alvo = regra.trim().toLowerCase();

  if (alvo.startsWith('.')) return arquivo.name.toLowerCase().endsWith(alvo);
  if (alvo.endsWith('/*')) return arquivo.type.toLowerCase().startsWith(alvo.slice(0, -1));
  return arquivo.type.toLowerCase() === alvo;
}

function listar(aceitos: readonly string[]): string {
  const nomes = aceitos.map((regra) =>
    regra.startsWith('.') ? regra : (regra.split('/').at(-1) ?? regra),
  );
  return nomes.length > 1
    ? `${nomes.slice(0, -1).join(', ')} ou ${nomes.at(-1)}`
    : (nomes[0] ?? '');
}

function formatarTamanho(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.ceil(bytes / 1024)} kB`;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1).replace('.', ',')} MB`;
}

/**
 * Área de envio de um arquivo: arrastar para cima dela ou "Escolher arquivo". Confere tipo
 * (`accept`, extensões como `.xlsx` ou MIME) e tamanho antes de emitir; o erro aparece dentro dela.
 */
@Component({
  selector: 'ui-file-dropzone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(dragover)': 'sobrevoar($event)',
    '(dragleave)': 'arrastando.set(false)',
    '(drop)': 'soltar($event)',
  },
  styles: `
    :host {
      display: block;
    }
    .ui-dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 22px;
      border: 2px dashed var(--border-dashed);
      border-radius: 14px;
      background: color-mix(in srgb, var(--page) 55%, var(--surface));
      text-align: center;
    }
    .ui-dropzone--ativa {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    }
    .ui-dropzone--erro {
      border-color: var(--badge-late-fg);
    }
    .ui-dropzone__titulo {
      font-size: 14px;
      font-weight: var(--font-weight-bold);
    }
    .ui-dropzone__dica {
      color: var(--muted);
      font-size: 13px;
    }
    .ui-dropzone__erro {
      color: var(--badge-late-fg);
      font-size: 13px;
      font-weight: var(--font-weight-semibold);
    }
    button {
      min-height: 44px;
      padding: 0 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-control);
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 13px var(--font);
      cursor: pointer;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    button:focus-visible {
      outline: 2px solid var(--accent-text);
      outline-offset: 2px;
    }
    input {
      display: none;
    }
  `,
  template: `
    <div
      class="ui-dropzone"
      [class.ui-dropzone--ativa]="arrastando()"
      [class.ui-dropzone--erro]="erro()"
    >
      <b class="ui-dropzone__titulo">{{ title() }}</b>
      @if (hint()) {
        <span class="ui-dropzone__dica">{{ hint() }}</span>
      }
      <button type="button" [disabled]="disabled()" (click)="entrada().nativeElement.click()">
        {{ buttonLabel() }}
      </button>
      <input
        #entrada
        type="file"
        tabindex="-1"
        [accept]="accept().join(',')"
        (change)="escolher($event)"
      />
      @if (erro(); as mensagem) {
        <span class="ui-dropzone__erro" role="alert">{{ mensagem }}</span>
      }
    </div>
  `,
})
export class FileDropzone {
  readonly title = input('Arraste o arquivo aqui');
  readonly hint = input<string>();
  readonly buttonLabel = input('Escolher arquivo');
  /** Extensões (`.xlsx`), tipos MIME (`image/png`) ou grupos (`image/*`). Vazio aceita tudo. */
  readonly accept = input<readonly string[]>([]);
  /** Tamanho máximo em bytes. */
  readonly maxSize = input<number>();
  readonly disabled = input(false);
  /** Erro vindo de fora (por exemplo, da API); tem prioridade sobre o da validação local. */
  readonly externalError = input<string>();

  readonly fileSelected = output<File>();
  readonly fileRejected = output<string>();

  protected readonly entrada = viewChild.required<ElementRef<HTMLInputElement>>('entrada');
  protected readonly arrastando = signal(false);
  private readonly erroLocal = signal<string | null>(null);
  protected readonly erro = computed(() => this.externalError() ?? this.erroLocal());

  protected sobrevoar(evento: DragEvent): void {
    if (this.disabled()) return;
    evento.preventDefault();
    this.arrastando.set(true);
  }

  protected soltar(evento: DragEvent): void {
    evento.preventDefault();
    this.arrastando.set(false);
    const arquivo = evento.dataTransfer?.files?.[0];
    if (arquivo && !this.disabled()) this.receber(arquivo);
  }

  protected escolher(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    if (arquivo) this.receber(arquivo);
    // Limpa para que escolher o mesmo arquivo de novo dispare o evento.
    campo.value = '';
  }

  private receber(arquivo: File): void {
    const motivo = validarArquivo(arquivo, this.accept(), this.maxSize());
    this.erroLocal.set(motivo);

    if (motivo) this.fileRejected.emit(motivo);
    else this.fileSelected.emit(arquivo);
  }
}
