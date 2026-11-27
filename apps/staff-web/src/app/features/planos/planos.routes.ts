import type { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Planos',
    loadComponent: () => import('./pages/planos.page').then((m) => m.PlanosPage),
  },
] satisfies Routes;
