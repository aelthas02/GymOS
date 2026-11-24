import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  PRIMEIROS_PASSOS_CONCLUIDOS,
  ROTA_DOS_PRIMEIROS_PASSOS,
  ROTA_INICIAL,
} from '../primeiros-passos';

/** Depois de entrar: primeiros passos se a academia ainda não concluiu, senão o Início. */
@Injectable({ providedIn: 'root' })
export class PosLogin {
  private readonly router = inject(Router);
  private readonly concluidos = inject(PRIMEIROS_PASSOS_CONCLUIDOS);

  ir(): void {
    this.concluidos().subscribe((ok) => {
      void this.router.navigateByUrl(ok ? ROTA_INICIAL : ROTA_DOS_PRIMEIROS_PASSOS);
    });
  }
}
