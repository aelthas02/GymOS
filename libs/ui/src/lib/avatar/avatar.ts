import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cssVar } from '../../../styles/tokens';
import type { BadgeVariant } from '../badge/badge';

/** Iniciais do nome: a primeira letra do primeiro nome (ou, com 2, primeiro e último nome). */
export function initials(name: string, length: 1 | 2 = 1): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = Array.from(words[0] ?? '')[0];
  if (!first) return '?';

  const last = words.length > 1 ? Array.from(words[words.length - 1] ?? '')[0] : undefined;
  return (length === 2 && last ? first + last : first).toLocaleUpperCase('pt-BR');
}

@Component({
  selector: 'ui-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'decorative() ? null : "img"',
    '[attr.aria-label]': 'decorative() ? null : name()',
    '[attr.aria-hidden]': 'decorative() ? "true" : null',
    '[style.background-color]': 'pair().bg',
    '[style.color]': 'pair().fg',
    '[style.--avatar-size.px]': 'size()',
  },
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: var(--avatar-size, 36px);
      height: var(--avatar-size, 36px);
      border-radius: 50%;
      font-size: calc(var(--avatar-size, 36px) * 0.39);
      font-weight: var(--font-weight-bold);
    }
  `,
  template: `{{ text() }}`,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input(36);
  readonly letters = input<1 | 2>(1);
  readonly tone = input<BadgeVariant>('ok');
  /** Quando o nome já aparece ao lado, o avatar não precisa ser lido. */
  readonly decorative = input(false);

  protected readonly text = computed(() => initials(this.name(), this.letters()));
  protected readonly pair = computed(() => ({
    bg: cssVar(`badge-${this.tone()}-bg`),
    fg: cssVar(`badge-${this.tone()}-fg`),
  }));
}
