import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/**
 * Devolve `ehAtivo(link, exact)`, que diz se o router está em `link`. Lê um signal que muda a cada
 * navegação concluída; por isso, chamada dentro de um `computed`, ele recalcula sozinho.
 * Chamar só em contexto de injeção (construtor ou inicializador de campo).
 */
export function injectIsActive(): (link: string, exact: boolean) => boolean {
  const router = inject(Router);
  const url = toSignal(
    router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => router.url),
    ),
    { initialValue: router.url },
  );

  return (link, exact) => {
    url();
    return router.isActive(link, {
      paths: exact ? 'exact' : 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  };
}
