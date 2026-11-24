import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthStore } from '../sessao/auth.store';

/** `/sair`: encerra a sessão e leva para `/entrar`. */
@Component({
  selector: 'app-sair-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Saindo…</p>`,
})
export class SairPage {
  constructor() {
    inject(AuthStore).sair();
  }
}
