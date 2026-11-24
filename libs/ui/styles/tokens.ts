/**
 * Espelho tipado de `tokens.css`: cada chave é o nome da custom property sem o `--`.
 * `tokens.spec.ts` confere que os dois arquivos têm as mesmas chaves e os mesmos valores.
 * Fonte: `docs/design/tokens/design-tokens.json`.
 */
export const tokens = {
  ink: '#0C1722',
  muted: '#4A5A6B',
  border: '#D5DDD8',
  divider: '#E3E9E5',
  page: '#F3F5F2',
  surface: '#FFFFFF',
  tutorial: '#F57C00',
  'on-ink': '#F2F5F0',
  'border-dashed': '#B9C4BE',
  'nav-fg': '#DCE4EC',
  'nav-muted': '#9FB0C2',
  'nav-card-bg': '#12222F',
  'nav-card-fg': '#C9D5E1',
  'state-error-border': '#F3C4B9',
  'state-error-fg': '#5C2417',
  'state-warn-border': '#EBD08A',
  'chart-bar': '#C9D5E1',
  'chart-negative': '#D9482B',
  'chart-2': '#3AA6F0',
  'chart-3': '#E0A82E',
  'chart-4': '#A78BFA',
  'chart-5': '#FF8A3D',
  'state-warn-fg': '#4D3500',
  'agenda-done-bg': '#D3DDE8',
  'agenda-done-fg': '#2F4256',
  'agenda-done-bar': '#7F95AB',
  'agenda-confirmed-bg': '#B6EBD3',
  'agenda-confirmed-fg': '#075C3C',
  'agenda-confirmed-bar': '#19B87A',
  'agenda-cancelled-bg': '#FBCFC6',
  'agenda-cancelled-fg': '#8A2410',
  'agenda-cancelled-bar': '#E0553A',
  'agenda-noshow-bg': '#E4D6F8',
  'agenda-noshow-fg': '#46277F',
  'agenda-noshow-bar': '#8B5CF6',
  'agenda-waiting-bg': '#FFDE85',
  'agenda-waiting-fg': '#5E4000',
  'agenda-waiting-bar': '#E0A000',
  'whatsapp-bg': '#E7DED2',

  // Tema padrão; o ThemeService troca os três pela cor da academia (ADR-014).
  accent: '#22C98A',
  'accent-contrast': '#0C1722',
  'accent-text': '#167F58',

  'badge-ok-bg': '#DDF5EA',
  'badge-ok-fg': '#0F6E4B',
  'badge-late-bg': '#FDECE8',
  'badge-late-fg': '#9B2C17',
  'badge-soon-bg': '#FFF3D6',
  'badge-soon-fg': '#7A5200',
  'badge-off-bg': '#E8ECEA',
  'badge-off-fg': '#4A5A6B',

  'mod-aulas': '#F57C00',
  'mod-marketing': '#7C5CFF',
  'mod-loja': '#0E9AA7',
  'mod-saude': '#22C98A',

  font: 'Inter, system-ui, sans-serif',
  'font-weight-regular': '400',
  'font-weight-medium': '500',
  'font-weight-semibold': '600',
  'font-weight-bold': '700',

  'radius-card': '16px',
  'radius-control': '10px',
  'radius-pill': '999px',
  'radius-phone': '34px',

  'sidebar-width': '250px',
  'page-padding': '32px',
  'card-padding': '20px',
  gap: '20px',
  'board-desktop-width': '1280px',
  'board-phone-width': '390px',
  'board-phone-height': '844px',
} as const;

export type TokenName = keyof typeof tokens;

/** `var(--nome)` de um token, para estilos montados em TypeScript. */
export function cssVar<Name extends TokenName>(name: Name): `var(--${Name})` {
  return `var(--${name})`;
}

/** Cores sugeridas na tela Identidade visual. */
export const suggestedAccents = ['#22C98A', '#3AA6F0', '#FF8A3D', '#A78BFA'] as const;
