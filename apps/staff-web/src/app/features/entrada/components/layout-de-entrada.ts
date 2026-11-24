import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TenantStore } from '../../../core/tenant/tenant.store';

/** Layout de duas colunas das telas de entrada (`Login.html`): marca à esquerda, formulário à direita. */
@Component({
  selector: 'app-layout-de-entrada',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      max-width: var(--board-desktop-width);
      min-height: 760px;
      background: var(--page);
      color: var(--ink);
    }
    .ajuda {
      position: absolute;
      top: 24px;
      right: 32px;
      z-index: 5;
      width: 44px;
      height: 44px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      color: var(--ink);
      font: var(--font-weight-semibold) 15px var(--font);
      cursor: pointer;
    }
    .marca {
      flex: 1 1 420px;
      min-width: 0;
      min-height: 760px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px;
      background: var(--ink);
      color: var(--on-ink);
    }
    .marca__nome {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: var(--font-weight-bold);
    }
    .marca__logo {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: var(--accent);
    }
    h1 {
      margin: 0;
      font-size: 44px;
      line-height: 1.1;
      font-weight: var(--font-weight-bold);
    }
    h1 span {
      color: var(--accent);
    }
    .marca p {
      max-width: 420px;
      margin: 16px 0 0;
      font-size: 16px;
      line-height: 1.5;
      color: var(--nav-card-fg);
    }
    .marca__rodape {
      font-size: 12px;
    }
    .painel {
      flex: 1 1 420px;
      min-width: 0;
      min-height: 760px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px;
    }
    .conteudo {
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .academia {
      font-size: 13px;
      color: var(--muted);
    }
    h2 {
      margin: 4px 0 0;
      font-size: 26px;
      font-weight: var(--font-weight-bold);
    }
  `,
  template: `
    <button type="button" class="ajuda" aria-label="Ajuda">?</button>
    <section class="marca" aria-label="GymOS">
      <div class="marca__nome"><span class="marca__logo" aria-hidden="true"></span>GymOS</div>
      <div>
        <h1>Sua academia sem <span>dor de cabeça</span>.</h1>
        <p>Alunos, planos, cobranças e aulas no mesmo lugar.</p>
      </div>
      <!-- Terceiro item do space-between: o protótipo ali tem "Tela ilustrativa.", que fica de fora. -->
      <small class="marca__rodape" aria-hidden="true">&nbsp;</small>
    </section>
    <main class="painel">
      <div class="conteudo">
        <div>
          <div class="academia">{{ nomeDaAcademia() }}</div>
          <h2>{{ heading() }}</h2>
        </div>
        <ng-content />
      </div>
    </main>
  `,
})
export class LayoutDeEntrada {
  readonly heading = input.required<string>();

  private readonly tenant = inject(TenantStore);
  protected readonly nomeDaAcademia = computed(() => this.tenant.identidade()?.nome ?? '');
}
