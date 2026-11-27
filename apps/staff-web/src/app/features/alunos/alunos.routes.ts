import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/sessao/guards';

export default [
  {
    path: '',
    title: 'Alunos',
    loadComponent: () => import('./pages/alunos.page').then((m) => m.AlunosPage),
  },
  {
    path: 'novo',
    title: 'Cadastrar aluno',
    canActivate: [permissionGuard('alunos:criar')],
    loadComponent: () => import('./pages/aluno-form.page').then((m) => m.AlunoFormPage),
  },
  {
    path: 'lote',
    title: 'Alunos em lote',
    loadComponent: () => import('./pages/alunos-lote.page').then((m) => m.AlunosLotePage),
  },
  {
    path: 'importar',
    title: 'Importar alunos',
    canActivate: [permissionGuard('alunos:criar')],
    loadComponent: () => import('./pages/importar.page').then((m) => m.ImportarPage),
  },
  {
    path: ':id/acompanhamento',
    title: 'Acompanhamento do aluno',
    loadComponent: () => import('./pages/acompanhamento.page').then((m) => m.AcompanhamentoPage),
  },
  {
    path: ':id',
    title: 'Editar aluno',
    canActivate: [permissionGuard('alunos:editar')],
    loadComponent: () => import('./pages/aluno-form.page').then((m) => m.AlunoFormPage),
  },
] satisfies Routes;
