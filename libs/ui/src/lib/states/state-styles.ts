/** Estilo compartilhado pelos estados (vazio, erro, sem permissão), de `Estados.html`. */
export const stateStyles = `
  :host {
    display: block;
  }
  .ui-state {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 28px;
    border: 1px dashed var(--border-dashed);
    border-radius: 14px;
    text-align: center;
    align-items: center;
  }
  .ui-state--error,
  .ui-state--warn {
    align-items: stretch;
    padding: 16px;
    border-style: solid;
    text-align: left;
  }
  .ui-state--error {
    border-color: var(--state-error-border);
    background: var(--badge-late-bg);
    color: var(--state-error-fg);
  }
  .ui-state--warn {
    border-color: var(--state-warn-border);
    background: var(--badge-soon-bg);
    color: var(--state-warn-fg);
  }
  .ui-state__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
    color: var(--accent-text);
  }
  .ui-state__title {
    font-size: 16px;
    font-weight: var(--font-weight-bold);
    color: var(--ink);
  }
  .ui-state--error .ui-state__title {
    font-size: 15px;
    color: var(--badge-late-fg);
  }
  .ui-state--warn .ui-state__title {
    font-size: 15px;
    color: var(--badge-soon-fg);
  }
  .ui-state__description {
    max-width: 320px;
    font-size: 14px;
    color: var(--muted);
  }
  .ui-state--error .ui-state__description,
  .ui-state--warn .ui-state__description {
    max-width: none;
    line-height: 1.5;
    color: inherit;
  }
  .ui-state__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .ui-state--error .ui-state__actions,
  .ui-state--warn .ui-state__actions {
    justify-content: flex-start;
  }
  .ui-state__actions:empty {
    display: none;
  }
`;
