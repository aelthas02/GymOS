import type { Routes } from '@angular/router';

export default [
  { path: '', pathMatch: 'full', redirectTo: 'fichas' },
  {
    path: 'fichas',
    title: 'Treinos',
    loadComponent: () => import('./pages/fichas.page').then((m) => m.FichasPage),
  },
  {
    path: 'modelos',
    title: 'Modelos de treino',
    loadComponent: () => import('./pages/modelos.page').then((m) => m.ModelosPage),
  },
  {
    path: 'biblioteca',
    title: 'Biblioteca de exercícios',
    loadComponent: () => import('./pages/biblioteca.page').then((m) => m.BibliotecaPage),
  },
] satisfies Routes;
