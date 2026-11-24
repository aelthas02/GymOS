import type { Routes } from '@angular/router';

/** Primeiros passos (T17): `/primeiros-passos/:passo`; o T17 troca a página provisória. */
export default [
  {
    path: ':passo',
    title: 'Primeiros passos',
    data: { titulo: 'Primeiros passos' },
    loadComponent: () =>
      import('../../core/paginas/em-construcao.page').then((m) => m.EmConstrucaoPage),
  },
] satisfies Routes;
