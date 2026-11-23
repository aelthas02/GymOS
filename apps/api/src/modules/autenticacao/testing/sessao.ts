import type { INestApplicationContext } from '@nestjs/common';
import type { Response } from 'supertest';
import { EmissorDeTokens, type ReivindicacoesDoAcesso } from '../application/portas';

export { CABECALHO_CSRF } from '../interface/http/cookies';

export interface CookieRecebido {
  nome: string;
  /** `nome=valor`, pronto para o cabeçalho Cookie. */
  par: string;
  /** Atributos em minúsculas; os sem valor (HttpOnly, Secure) valem true. */
  atributos: Record<string, string | true>;
}

/** O cookie de refresh gravado pela resposta (o primeiro Set-Cookie). */
export function cookieDaResposta(resposta: Response): CookieRecebido {
  const cabecalho = resposta.headers['set-cookie'] as unknown as string[] | undefined;
  const [par = '', ...atributos] = (cabecalho?.[0] ?? '').split(';').map((parte) => parte.trim());
  return {
    nome: par.slice(0, par.indexOf('=')),
    par,
    atributos: Object.fromEntries(
      atributos.map((atributo) => {
        const [chave = '', valor] = atributo.split('=');
        return [chave.toLowerCase(), valor ?? true];
      }),
    ),
  };
}

/** Token de acesso de teste sem passar pelo login (nem pelo limite de tentativas). */
export function tokenDeAcesso(
  app: INestApplicationContext,
  reivindicacoes: ReivindicacoesDoAcesso,
): string {
  return app.get(EmissorDeTokens).emitir(reivindicacoes, new Date(Date.now()));
}
