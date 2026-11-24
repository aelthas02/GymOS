import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { URLS } from './config';
import { cabecalhosDeApi } from './api';

/** Senha de todos os usuários do seed (`apps/api/src/seed/autenticacao.ts`). */
export const SENHA_DO_SEED = 'gymos1234';

export type Papel = 'administrador' | 'gerente' | 'recepcao' | 'professor' | 'aluno';

interface Credencial {
  email: string;
  /** Login do painel (`staff`) ou do app (`aluno`). */
  area: 'staff' | 'aluno';
}

/**
 * Quem entra por papel: os usuários do seed da Academia Ritmo. O aluno só passa a existir quando o
 * módulo de seed `alunos` (T15a) criar o aluno do E2E e preencher esta credencial.
 */
const CREDENCIAIS: Record<Papel, Credencial | null> = {
  administrador: { email: 'admin@academiaritmo.com', area: 'staff' },
  gerente: { email: 'carla@academiaritmo.com', area: 'staff' },
  recepcao: { email: 'joao@academiaritmo.com', area: 'staff' },
  professor: { email: 'diego@academiaritmo.com', area: 'staff' },
  aluno: null,
};

export interface Sessao {
  accessToken: string;
}

/**
 * Faz o login do papel na API. O cookie de refresh fica no `request` (e, se vier de
 * `context.request`, no navegador); o token de acesso volta para chamadas autenticadas.
 */
export async function entrarComo(request: APIRequestContext, papel: Papel): Promise<Sessao> {
  const credencial = CREDENCIAIS[papel];
  if (!credencial) {
    throw new Error(
      `O papel "${papel}" ainda não tem usuário no seed: o módulo "alunos" (T15a) o registra em ` +
        'apps/api/src/seed e a credencial entra em apps/e2e/src/papeis.ts.',
    );
  }
  const resposta = await request.post(`${URLS.api}/api/auth/${credencial.area}/login`, {
    headers: cabecalhosDeApi(),
    data: { email: credencial.email, senha: SENHA_DO_SEED },
  });
  if (!resposta.ok()) {
    throw new Error(`Login de ${papel} falhou (${resposta.status()}): ${await resposta.text()}`);
  }
  return (await resposta.json()) as Sessao;
}

/** Entra no navegador: o refresh fica nos cookies do contexto e o front obtém o token ao abrir. */
export async function entrarNoNavegadorComo(
  context: BrowserContext,
  papel: Papel,
): Promise<Sessao> {
  return entrarComo(context.request, papel);
}
