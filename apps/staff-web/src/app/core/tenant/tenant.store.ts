import { inject, Injectable, signal } from '@angular/core';
import { CLIENTE_DA_API, type Schemas } from '@gymos/api-contracts';
import { ThemeService } from '@gymos/ui';
import { catchError, map, type Observable, of, tap } from 'rxjs';

export type IdentidadeDoTenant = Schemas['IdentidadeDoTenantDto'];

/** Identidade da academia do subdomínio (`GET /public/tenant`), carregada antes de qualquer tela. */
@Injectable({ providedIn: 'root' })
export class TenantStore {
  private readonly api = inject(CLIENTE_DA_API);
  private readonly tema = inject(ThemeService);
  private readonly dados = signal<IdentidadeDoTenant | null>(null);

  readonly identidade = this.dados.asReadonly();

  /** Aplica a cor da academia no tema. Falha (academia não encontrada) mantém o tema padrão. */
  carregar(): Observable<void> {
    return this.api.get('/api/public/tenant').pipe(
      tap((identidade) => {
        this.dados.set(identidade);
        this.tema.setAccent(identidade.corDestaque);
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }
}
