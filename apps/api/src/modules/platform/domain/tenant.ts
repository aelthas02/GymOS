/** Academia cliente do GymOS, como a plataforma a conhece antes de qualquer contexto. */
export interface Tenant {
  id: string;
  slug: string;
  nome: string;
  corDestaque: string;
  logotipoUrl: string | null;
  plano: string;
  configurada: boolean;
}

/** Nome, cor de destaque e logotipo: o que o Passo 1 e Configurações editam. */
export interface IdentidadeDoTenant {
  nome: string;
  corDestaque: string;
  logotipoUrl: string | null;
}

export const FORMATO_DO_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
export const FORMATO_DA_COR = /^#[0-9A-Fa-f]{6}$/;
export const COR_DE_DESTAQUE_PADRAO = '#22C98A';

/** Subdomínios que não podem virar academia. */
export const SLUGS_RESERVADOS: readonly string[] = [
  'admin',
  'api',
  'app',
  'docs',
  'mail',
  'painel',
  'static',
  'status',
  'www',
];

export function slugDisponivelParaAcademia(slug: string): boolean {
  return FORMATO_DO_SLUG.test(slug) && !SLUGS_RESERVADOS.includes(slug);
}

/**
 * Slug do tenant a partir do cabeçalho Host: `ritmo.gymos.app` com domínio base `gymos.app` → `ritmo`.
 * Só um rótulo antes do domínio base; porta e maiúsculas são ignoradas.
 */
export function slugDoHost(host: string | undefined, dominioBase: string): string | null {
  if (!host) {
    return null;
  }
  const semPorta = host.trim().toLowerCase().replace(/:\d+$/, '');
  const sufixo = `.${dominioBase.toLowerCase()}`;
  if (!semPorta.endsWith(sufixo)) {
    return null;
  }
  const slug = semPorta.slice(0, -sufixo.length);
  return FORMATO_DO_SLUG.test(slug) ? slug : null;
}
