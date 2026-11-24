import { ForbiddenException } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { GLOBAL_PREFIX } from '../../../../app/configure-app';
import type { SessaoAberta } from '../../application/sessoes';
import type { Publico } from '../../domain/credenciais';

/**
 * Cookie de refresh por app: nome e Path próprios e host-only (sem Domain), para o painel e o app do
 * aluno conviverem no mesmo host sem um sobrescrever o outro. O Path inclui o prefixo /api.
 */
export const COOKIE_DE_REFRESH: Readonly<Record<Publico, { nome: string; caminho: string }>> = {
  staff: { nome: 'gymos_rt_staff', caminho: `/${GLOBAL_PREFIX}/auth/staff` },
  aluno: { nome: 'gymos_rt_aluno', caminho: `/${GLOBAL_PREFIX}/auth/aluno` },
};

/** Cabeçalho exigido no refresh e no logout: outro site não o envia sem passar pelo CORS. */
export const CABECALHO_CSRF = 'x-gymos-csrf';

function opcoes(publico: Publico): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: COOKIE_DE_REFRESH[publico].caminho,
  };
}

export function gravarRefresh(res: Response, publico: Publico, sessao: SessaoAberta): void {
  res.cookie(COOKIE_DE_REFRESH[publico].nome, sessao.refresh, {
    ...opcoes(publico),
    expires: sessao.refreshExpiraEm,
  });
}

export function apagarRefresh(res: Response, publico: Publico): void {
  res.clearCookie(COOKIE_DE_REFRESH[publico].nome, opcoes(publico));
}

export function lerRefresh(req: Request, publico: Publico): string | null {
  const nome = COOKIE_DE_REFRESH[publico].nome;
  for (const par of (req.headers.cookie ?? '').split(';')) {
    const separador = par.indexOf('=');
    if (separador > 0 && par.slice(0, separador).trim() === nome) {
      return decodeURIComponent(par.slice(separador + 1).trim()) || null;
    }
  }
  return null;
}

function hostname(valor: string): string | null {
  try {
    return new URL(valor.includes('://') ? valor : `http://${valor}`).hostname;
  } catch {
    return null;
  }
}

/**
 * CSRF do refresh e do logout: exige o cabeçalho próprio, recusa requisição que o navegador marca
 * como de outro site e Origin de outro host. O SameSite=Lax já barra o POST vindo de outro site.
 */
export function exigirMesmaOrigem(req: Request): void {
  const origem = req.headers.origin;
  const site = req.headers['sec-fetch-site'];
  if (
    req.headers[CABECALHO_CSRF] !== '1' ||
    site === 'cross-site' ||
    (origem !== undefined && hostname(origem) !== hostname(req.headers.host ?? ''))
  ) {
    throw new ForbiddenException('Requisição de outra origem recusada.');
  }
}
