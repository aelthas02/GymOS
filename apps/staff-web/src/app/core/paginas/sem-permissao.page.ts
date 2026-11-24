import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, NoPermissionState } from '@gymos/ui';

@Component({
  selector: 'app-sem-permissao-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoPermissionState, Button, RouterLink],
  template: `
    <ui-no-permission-state>
      <ui-button actions variant="primary" routerLink="/inicio">Voltar ao início</ui-button>
    </ui-no-permission-state>
  `,
})
export class SemPermissaoPage {}
