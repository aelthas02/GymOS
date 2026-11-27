/** Estilos comuns das telas do Financeiro (cartões, títulos de seção e grade de duas colunas). */
export const ESTILOS_DO_FINANCEIRO = `
  :host {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .fin-cartao {
    box-sizing: border-box;
    min-width: 0;
    padding: 20px;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--surface);
  }
  .fin-cartao__topo {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }
  .fin-cartao h2 {
    margin: 0;
    font-size: 16px;
    font-weight: var(--font-weight-bold);
  }
  .fin-cartao__sub {
    margin: 3px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  .fin-grade {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 20px;
  }
  .fin-grade__principal {
    flex: 1.8 1 560px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .fin-grade__lateral {
    flex: 1 1 250px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .fin-linha-de-valor {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 0;
    border-top: 1px solid var(--divider);
    font-size: 14px;
  }
  .fin-linha-de-valor > span:first-child {
    color: var(--muted);
  }
  .fin-aviso {
    padding: 10px 12px;
    border-radius: var(--radius-control);
    font-size: 13px;
    font-weight: var(--font-weight-semibold);
  }
  .fin-aviso--ok {
    background: var(--badge-ok-bg);
    color: var(--badge-ok-fg);
  }
  .fin-aviso--alerta {
    background: var(--badge-soon-bg);
    color: var(--badge-soon-fg);
  }
  .fin-aviso--erro {
    background: var(--badge-late-bg);
    color: var(--badge-late-fg);
  }
  @media (max-width: 599px) {
    :host {
      gap: 16px;
    }
    .fin-cartao {
      padding: 16px;
    }
  }
`;
