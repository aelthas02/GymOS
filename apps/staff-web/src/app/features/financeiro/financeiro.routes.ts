import type { Routes } from '@angular/router';

const visao = (
  path: string,
  titulo: string,
  visao: string,
  subtitulo: string,
  semReferencia = false,
): Routes[number] => ({
  path,
  title: titulo,
  data: { visao, subtitulo, ...(semReferencia ? { semReferencia: true } : {}) },
  loadComponent: () => import('./pages/visao-financeira.page').then((m) => m.VisaoFinanceiraPage),
});

/** Rotas do Financeiro: visão geral, as visões do "Visualizar por" e as notas fiscais (T20). */
export default [
  {
    path: '',
    pathMatch: 'full',
    title: 'Financeiro',
    loadComponent: () => import('./pages/financeiro-geral.page').then((m) => m.FinanceiroGeralPage),
  },
  visao(
    'setores',
    'Financeiro · Setores',
    'setores',
    'Receita e despesas separadas por setor da academia.',
  ),
  visao(
    'funcionarios',
    'Financeiro · Funcionários',
    'funcionarios',
    'Custo da equipe e receita gerada por funcionário.',
  ),
  visao('alunos', 'Financeiro · Alunos', 'alunos', 'Quanto cada aluno paga e quem está em atraso.'),
  visao('aulas', 'Financeiro · Aulas', 'aulas', 'Receita e ocupação das aulas coletivas e lutas.'),
  // Sem tela no protótipo: o layout de FinAlunos.html (rota com `semReferencia`).
  visao('planos', 'Financeiro · Planos', 'planos', 'Receita e alunos de cada plano.', true),
  visao(
    'formas-de-pagamento',
    'Financeiro · Forma de pagamento',
    'formas-de-pagamento',
    'Receita, taxas e pagamentos de cada forma de pagamento.',
    true,
  ),
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
