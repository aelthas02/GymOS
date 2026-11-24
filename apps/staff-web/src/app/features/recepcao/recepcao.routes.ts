import type { Routes } from '@angular/router';

/** Rotas da feature; o dono troca a página provisória pelas telas reais. */
export default [
  {
    path: '',
    title: 'Recepção',
    data: { titulo: 'Recepção' },
    loadComponent: () =>
      import('../../core/paginas/em-construcao.page').then((m) => m.EmConstrucaoPage),
  },
] satisfies Routes;
