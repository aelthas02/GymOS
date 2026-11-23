import { computed, DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { accentPalette, type AccentPalette } from '../../../styles/contrast';
import { tokens } from '../../../styles/tokens';

/**
 * Tema da academia (ADR-014). Recebe a cor de destaque e escreve no `documentElement` as três
 * variáveis derivadas dela; o restante do CSS só lê `var(--accent*)`. Quem carrega a cor da API
 * (T14 no painel, T32 no app do aluno) chama `setAccent`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly current = signal<AccentPalette>(accentPalette(tokens.accent));

  readonly palette = this.current.asReadonly();
  readonly accent = computed(() => this.current().accent);
  readonly accentContrast = computed(() => this.current().contrast);
  readonly accentText = computed(() => this.current().text);

  /** Lança `InvalidHexColorError` se a cor não for `#RGB` ou `#RRGGBB`; o tema fica como estava. */
  setAccent(hex: string): void {
    const palette = accentPalette(hex);

    this.root.style.setProperty('--accent', palette.accent);
    this.root.style.setProperty('--accent-contrast', palette.contrast);
    this.root.style.setProperty('--accent-text', palette.text);
    this.current.set(palette);
  }
}
