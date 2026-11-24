import type { Routes } from '@angular/router';

/** Rotas da feature; o dono troca a página provisória pelas telas reais. */
export default [
  {
    path: '',
    title: 'Início',
    data: { titulo: 'Início' },
    loadComponent: () =>
      import('../../core/paginas/em-construcao.page').then((m) => m.EmConstrucaoPage),
  },
] satisfies Routes;
