/** Estilos dos formulários de entrada (`Login.html`): campo, link, aviso e rodapé. */
export const ESTILOS_DA_ENTRADA = `
  form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .entrada__campo {
    height: 44px;
    width: 100%;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--surface);
    color: var(--ink);
    font: var(--font-weight-regular) 14px var(--font);
  }
  .entrada__campo:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 2px;
  }
  .entrada__campo[aria-invalid='true'] {
    border-color: var(--badge-late-fg);
  }
  .entrada__link {
    font-size: 13px;
    font-weight: var(--font-weight-semibold);
    color: var(--ink);
    text-decoration: underline;
  }
  .entrada__aviso {
    padding: 12px;
    border: 1px solid var(--state-error-border);
    border-radius: var(--radius-control);
    background: var(--badge-late-bg);
    color: var(--badge-late-fg);
    font-size: 13px;
    line-height: 1.5;
  }
  .entrada__aviso--ok {
    border-color: var(--border);
    background: var(--badge-ok-bg);
    color: var(--badge-ok-fg);
  }
  .entrada__rodape {
    padding-top: 16px;
    border-top: 1px solid var(--border);
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }
`;
