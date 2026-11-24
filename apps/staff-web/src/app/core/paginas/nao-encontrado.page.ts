import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, EmptyState } from '@gymos/ui';

@Component({
  selector: 'app-nao-encontrado-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, Button, RouterLink],
  template: `
    <ui-empty-state
      heading="Página não encontrada"
      description="O endereço não existe ou esse módulo não está ativo na sua academia."
    >
      <ui-button actions variant="primary" routerLink="/inicio">Voltar ao início</ui-button>
    </ui-empty-state>
  `,
})
export class NaoEncontradoPage {}
