/** Relógio fixo do E2E e da regressão visual: 19/11/2026 09:00 em America/Sao_Paulo (UTC−3, sem horário de verão). */
export const RELOGIO_PADRAO = '2026-11-19T09:00:00-03:00';
export const FUSO_PADRAO = 'America/Sao_Paulo';

export const TENANT_DO_SEED = 'ritmo';
export const CABECALHO_DO_RELOGIO = 'x-relogio';
export const CABECALHO_DO_TENANT = 'x-tenant';
export const CABECALHO_DA_CHAVE_DE_OPERACAO = 'x-chave-de-operacao';

export const PORTAS = {
  api: Number(process.env['E2E_API_PORTA'] ?? 3100),
  painel: Number(process.env['E2E_PAINEL_PORTA'] ?? 4200),
  aluno: Number(process.env['E2E_ALUNO_PORTA'] ?? 4300),
} as const;

export const URLS = {
  api: process.env['E2E_API_URL'] ?? `http://localhost:${PORTAS.api}`,
  painel: `http://localhost:${PORTAS.painel}`,
  aluno: `http://localhost:${PORTAS.aluno}`,
} as const;

/** Chave do endpoint interno e da API de teste; a mesma do ambiente que o `pnpm e2e` sobe. */
export const CHAVE_DE_OPERACAO =
  process.env['OPERACAO_API_KEY'] ?? 'gymos-dev-chave-de-operacao-troque-fora-do-dev';

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const;

/** Limiar da regressão visual (ADR-019): fração dos pixels que pode diferir do HTML de referência. */
export const LIMIAR_DE_PIXELS = 0.005;

/** Hosts que a página pode acessar: tudo o que é local; o resto é rede externa e falha o teste. */
export const HOSTS_PERMITIDOS = [/^localhost$/, /\.localhost$/, /^127\.0\.0\.1$/, /\.gymos\.test$/];
