import type { Routes } from '@angular/router';

/** Rotas da feature; o dono troca a página provisória pelas telas reais. */
export default [
  {
    path: '',
    pathMatch: 'full',
    title: 'Financeiro',
    data: { titulo: 'Financeiro' },
    loadComponent: () =>
      import('../../core/paginas/em-construcao.page').then((m) => m.EmConstrucaoPage),
  },
  {
    path: 'notas-fiscais',
    title: 'Notas fiscais',
    loadComponent: () => import('./pages/notas-fiscais.page').then((m) => m.NotasFiscaisPage),
  },
  {
    path: 'notas-fiscais/emitir',
    title: 'Emitir nota fiscal',
    loadComponent: () => import('./pages/emitir-nota.page').then((m) => m.EmitirNotaPage),
  },
] satisfies Routes;
