import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

const ID_DO_YOUTUBE = /^[\w-]{11}$/;

/** Id de 11 caracteres a partir do id puro ou de um link do YouTube; `null` se não for um. */
export function extrairIdDoYoutube(entrada: string): string | null {
  const texto = entrada.trim();
  if (ID_DO_YOUTUBE.test(texto)) return texto;

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^(www|m)\./, '');
  const candidato =
    host === 'youtu.be'
      ? url.pathname.split('/')[1]
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? (url.searchParams.get('v') ??
          url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1])
        : undefined;

  return candidato && ID_DO_YOUTUBE.test(candidato) ? candidato : null;
}

/**
 * Vídeo do YouTube em fachada: mostra a miniatura com um botão de reproduzir e só cria o `iframe`
 * (do domínio sem cookies, `youtube-nocookie.com`) depois do clique, para a página não carregar o
 * player de terceiros antes de o aluno querer assistir.
 */
@Component({
  selector: 'ui-video-embed',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .ui-video {
      position: relative;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: 14px;
      background: var(--ink);
    }
    .ui-video__capa,
    iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }
    .ui-video__capa {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      background: none;
      cursor: pointer;
    }
    .ui-video__capa img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .ui-video__capa:focus-visible {
      outline: 3px solid var(--accent-text);
      outline-offset: -3px;
    }
    .ui-video__play {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--ink) 80%, transparent);
      color: var(--on-ink);
      font-size: 24px;
    }
    .ui-video__indisponivel {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--on-ink);
      font-size: 14px;
    }
  `,
  template: `
    <div class="ui-video">
      @if (idDoVideo(); as id) {
        @if (carregado()) {
          <iframe
            [src]="urlDoPlayer()"
            [title]="title()"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
          ></iframe>
        } @else {
          <button
            type="button"
            class="ui-video__capa"
            [attr.aria-label]="'Reproduzir vídeo: ' + title()"
            (click)="reproduzir()"
          >
            <img
              [src]="thumbnail() ?? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'"
              alt=""
              loading="lazy"
            />
            <span class="ui-video__play" aria-hidden="true">&#9654;</span>
          </button>
        }
      } @else {
        <div class="ui-video__capa ui-video__indisponivel">Vídeo indisponível</div>
      }
    </div>
  `,
})
export class VideoEmbed {
  /** Link ou id do vídeo no YouTube. */
  readonly video = input.required<string>();
  readonly title = input.required<string>();
  /** Miniatura própria; sem ela, usa a do YouTube. */
  readonly thumbnail = input<string>();

  readonly played = output<void>();

  private readonly sanitizer = inject(DomSanitizer);
  protected readonly carregado = signal(false);
  protected readonly idDoVideo = computed(() => extrairIdDoYoutube(this.video()));
  protected readonly urlDoPlayer = computed<SafeResourceUrl>(() =>
    // O id passou por `extrairIdDoYoutube` (11 caracteres seguros), então a URL é confiável.
    this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${this.idDoVideo() ?? ''}?autoplay=1&rel=0`,
    ),
  );

  protected reproduzir(): void {
    this.carregado.set(true);
    this.played.emit();
  }
}
