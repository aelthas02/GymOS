import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { URLS } from './config';
import { cabecalhosDeApi } from './api';

/** Senha de todos os usuários do seed (equipe em `seed/autenticacao.ts`, aluno em `seed/alunos.ts`). */
export const SENHA_DO_SEED = 'gymos1234';

export type Papel = 'administrador' | 'gerente' | 'recepcao' | 'professor' | 'aluno';

interface Credencial {
  /** E-mail da equipe; no app, o identificador do aluno (e-mail ou CPF). */
  email: string;
  /** Login do painel (`staff`) ou do app (`aluno`). */
  area: 'staff' | 'aluno';
}

/** Quem entra por papel: os usuários do seed da Academia Ritmo; o aluno é o Pedro Almeida (T15a). */
const CREDENCIAIS: Record<Papel, Credencial> = {
  administrador: { email: 'admin@academiaritmo.com', area: 'staff' },
  gerente: { email: 'carla@academiaritmo.com', area: 'staff' },
  recepcao: { email: 'joao@academiaritmo.com', area: 'staff' },
  professor: { email: 'diego@academiaritmo.com', area: 'staff' },
  aluno: { email: 'pedro.almeida@email.com', area: 'aluno' },
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
  const resposta = await request.post(`${URLS.api}/api/auth/${credencial.area}/login`, {
    headers: cabecalhosDeApi(),
    data:
      credencial.area === 'aluno'
        ? { identificador: credencial.email, senha: SENHA_DO_SEED }
        : { email: credencial.email, senha: SENHA_DO_SEED },
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
