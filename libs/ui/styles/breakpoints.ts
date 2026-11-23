/** Larguras mínimas em px; abaixo de `tablet` é mobile. Iguais a `_breakpoints.scss`. */
export const breakpoints = { tablet: 768, desktop: 1280 } as const;

/** Media queries para `matchMedia` e `BreakpointObserver`, iguais aos mixins do SCSS. */
export const mediaQueries = {
  mobile: `(max-width: ${breakpoints.tablet - 0.02}px)`,
  tablet: `(min-width: ${breakpoints.tablet}px) and (max-width: ${breakpoints.desktop - 0.02}px)`,
  tabletUp: `(min-width: ${breakpoints.tablet}px)`,
  desktop: `(min-width: ${breakpoints.desktop}px)`,
} as const;
