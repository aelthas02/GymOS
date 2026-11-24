import type { Route } from '@angular/router';
import { authGuard, featureFlagGuard, permissionGuard } from './core/sessao/guards';

/**
 * Raiz do painel. Cada feature é uma rota lazy que carrega `features/<feature>/<feature>.routes.ts`;
 * o dono da feature só mexe nesse arquivo (e na própria linha aqui, se precisar mudar a guarda).
 * Módulos extras exigem a flag do plano e a permissão de "ver".
 */
export const appRoutes: Route[] = [
  {
    path: 'entrar',
    title: 'Entrar no painel',
    loadComponent: () => import('./features/entrada/pages/entrar.page').then((m) => m.EntrarPage),
  },
  {
    path: 'esqueci-senha',
    title: 'Esqueci minha senha',
    data: { semReferencia: true },
    loadComponent: () =>
      import('./features/entrada/pages/esqueci-senha.page').then((m) => m.EsqueciSenhaPage),
  },
  {
    path: 'redefinir-senha/:token',
    title: 'Criar nova senha',
    data: { semReferencia: true },
    loadComponent: () =>
      import('./features/entrada/pages/redefinir-senha.page').then((m) => m.RedefinirSenhaPage),
  },
  {
    path: 'convite/:token',
    title: 'Aceitar convite',
    data: { semReferencia: true },
    loadComponent: () =>
      import('./features/entrada/pages/aceitar-convite.page').then((m) => m.AceitarConvitePage),
  },
  {
    path: 'primeiros-passos',
    canActivate: [authGuard],
    loadChildren: () => import('./features/primeiros-passos/primeiros-passos.routes'),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/shell/shell.page').then((m) => m.ShellPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        canActivate: [permissionGuard('inicio:ver')],
        loadChildren: () => import('./features/inicio/inicio.routes'),
      },
      {
        path: 'recepcao',
        canActivate: [permissionGuard('recepcao:ver')],
        loadChildren: () => import('./features/recepcao/recepcao.routes'),
      },
      {
        path: 'alunos',
        canActivate: [permissionGuard('alunos:ver')],
        loadChildren: () => import('./features/alunos/alunos.routes'),
      },
      {
        path: 'planos',
        canActivate: [permissionGuard('planos:ver')],
        loadChildren: () => import('./features/planos/planos.routes'),
      },
      {
        path: 'financeiro',
        canActivate: [permissionGuard('financeiro:ver')],
        loadChildren: () => import('./features/financeiro/financeiro.routes'),
      },
      {
        path: 'crm',
        canActivate: [permissionGuard('crm:ver')],
        loadChildren: () => import('./features/crm/crm.routes'),
      },
      {
        path: 'acesso',
        canActivate: [permissionGuard('acesso:ver')],
        loadChildren: () => import('./features/acesso/acesso.routes'),
      },
      {
        path: 'treinos',
        canActivate: [permissionGuard('treinos:ver')],
        loadChildren: () => import('./features/treinos/treinos.routes'),
      },
      {
        path: 'relatorios',
        canActivate: [permissionGuard('relatorios:ver')],
        loadChildren: () => import('./features/relatorios/relatorios.routes'),
      },
      {
        path: 'equipe',
        canActivate: [permissionGuard('equipe:ver')],
        loadChildren: () => import('./features/equipe/equipe.routes'),
      },
      {
        path: 'permissoes',
        canActivate: [permissionGuard('permissoes:ver')],
        loadChildren: () => import('./features/permissoes/permissoes.routes'),
      },
      {
        path: 'configuracoes',
        canActivate: [permissionGuard('configuracoes:ver')],
        loadChildren: () => import('./features/configuracoes/configuracoes.routes'),
      },
      {
        path: 'aulas',
        canActivate: [featureFlagGuard('aulas'), permissionGuard('aulas:ver')],
        loadChildren: () => import('./features/aulas/aulas.routes'),
      },
      {
        path: 'marketing',
        canActivate: [featureFlagGuard('marketing'), permissionGuard('marketing:ver')],
        loadChildren: () => import('./features/marketing/marketing.routes'),
      },
      {
        path: 'loja',
        canActivate: [featureFlagGuard('loja'), permissionGuard('loja:ver')],
        loadChildren: () => import('./features/loja/loja.routes'),
      },
      {
        path: 'saude',
        canActivate: [featureFlagGuard('saude'), permissionGuard('saude:ver')],
        loadChildren: () => import('./features/saude/saude.routes'),
      },
      {
        path: 'sair',
        loadComponent: () => import('./core/paginas/sair.page').then((m) => m.SairPage),
      },
      {
        path: 'sem-permissao',
        title: 'Sem permissão',
        loadComponent: () =>
          import('./core/paginas/sem-permissao.page').then((m) => m.SemPermissaoPage),
      },
      {
        path: '**',
        title: 'Página não encontrada',
        loadComponent: () =>
          import('./core/paginas/nao-encontrado.page').then((m) => m.NaoEncontradoPage),
      },
    ],
  },
];
