import { HttpClient } from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { components, paths } from '../generated/schema';

/** Schemas do contrato: `Schemas['IdentidadeDoTenantDto']`. */
export type Schemas = components['schemas'];

export type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Caminhos do contrato que aceitam o método M. */
export type CaminhoCom<M extends Metodo> = {
  [C in keyof paths]: paths[C][M] extends undefined ? never : C;
}[keyof paths];

type Operacao<C extends keyof paths, M extends Metodo> = NonNullable<paths[C][M]>;

type Json<T> = T extends { content: { 'application/json': infer Corpo } } ? Corpo : void;

/** Corpo da resposta de sucesso (200 ou 201) da operação. */
export type Resposta<C extends keyof paths, M extends Metodo> =
  Operacao<C, M> extends { responses: infer R }
    ? R extends { 200: infer Ok }
      ? Json<Ok>
      : R extends { 201: infer Criado }
        ? Json<Criado>
        : void
    : never;

/** Corpo da requisição da operação (`never` quando não tem). */
export type Corpo<C extends keyof paths, M extends Metodo> =
  Operacao<C, M> extends { requestBody: { content: { 'application/json': infer B } } } ? B : never;

type Parametros<C extends keyof paths, M extends Metodo> =
  Operacao<C, M> extends { parameters: infer P } ? P : never;

export interface OpcoesDaRequisicao<C extends keyof paths, M extends Metodo> {
  caminho?: Parametros<C, M> extends { path: infer P } ? P : never;
  consulta?: Parametros<C, M> extends { query?: infer Q } ? Q : never;
}

/**
 * Cliente fino sobre o HttpClient, tipado pelo contrato gerado (ADR-005). Nada de tipo de API escrito
 * à mão: caminhos, corpos e respostas vêm de `paths`.
 */
export interface ClienteDaApi {
  get<C extends CaminhoCom<'get'>>(
    caminho: C,
    opcoes?: OpcoesDaRequisicao<C, 'get'>,
  ): Observable<Resposta<C, 'get'>>;
  post<C extends CaminhoCom<'post'>>(
    caminho: C,
    corpo: Corpo<C, 'post'>,
    opcoes?: OpcoesDaRequisicao<C, 'post'>,
  ): Observable<Resposta<C, 'post'>>;
  put<C extends CaminhoCom<'put'>>(
    caminho: C,
    corpo: Corpo<C, 'put'>,
    opcoes?: OpcoesDaRequisicao<C, 'put'>,
  ): Observable<Resposta<C, 'put'>>;
  patch<C extends CaminhoCom<'patch'>>(
    caminho: C,
    corpo: Corpo<C, 'patch'>,
    opcoes?: OpcoesDaRequisicao<C, 'patch'>,
  ): Observable<Resposta<C, 'patch'>>;
  delete<C extends CaminhoCom<'delete'>>(
    caminho: C,
    opcoes?: OpcoesDaRequisicao<C, 'delete'>,
  ): Observable<Resposta<C, 'delete'>>;
}

/** Origem da API; vazia quando a API responde no mesmo host (`/api/...`). */
export const URL_BASE_DA_API = new InjectionToken<string>('URL_BASE_DA_API', {
  providedIn: 'root',
  factory: () => '',
});

type Valor = string | number | boolean;

function montarUrl(
  base: string,
  caminho: string,
  opcoes: { caminho?: unknown; consulta?: unknown } = {},
): { url: string; params?: Record<string, Valor | readonly Valor[]> } {
  const parametros = (opcoes.caminho ?? {}) as Record<string, Valor>;
  const url = caminho.replace(/\{([^}]+)\}/g, (_trecho, nome: string) => {
    const valor = parametros[nome];
    if (valor === undefined) {
      throw new Error(`Parâmetro de caminho "${nome}" ausente em ${caminho}.`);
    }
    return encodeURIComponent(String(valor));
  });
  const consulta = Object.entries((opcoes.consulta ?? {}) as Record<string, unknown>).filter(
    ([, valor]) => valor !== undefined && valor !== null,
  ) as Array<[string, Valor | readonly Valor[]]>;
  return {
    url: `${base}${url}`,
    ...(consulta.length > 0 ? { params: Object.fromEntries(consulta) } : {}),
  };
}

export function criarClienteDaApi(http: HttpClient, base = ''): ClienteDaApi {
  const requisitar = <T>(
    metodo: Metodo,
    caminho: string,
    corpo: unknown,
    opcoes?: object,
  ): Observable<T> => {
    const { url, params } = montarUrl(base, caminho, opcoes);
    return http.request<T>(metodo.toUpperCase(), url, {
      body: corpo,
      params,
      observe: 'body',
      responseType: 'json',
    });
  };
  const cliente: ClienteDaApi = {
    get: (caminho, opcoes) => requisitar('get', caminho, undefined, opcoes),
    post: (caminho, corpo, opcoes) => requisitar('post', caminho, corpo, opcoes),
    put: (caminho, corpo, opcoes) => requisitar('put', caminho, corpo, opcoes),
    patch: (caminho, corpo, opcoes) => requisitar('patch', caminho, corpo, opcoes),
    delete: (caminho, opcoes) => requisitar('delete', caminho, undefined, opcoes),
  };
  return cliente;
}

/** `inject(CLIENTE_DA_API)` nos stores das features. */
export const CLIENTE_DA_API = new InjectionToken<ClienteDaApi>('CLIENTE_DA_API', {
  providedIn: 'root',
  factory: () => criarClienteDaApi(inject(HttpClient), inject(URL_BASE_DA_API)),
});
