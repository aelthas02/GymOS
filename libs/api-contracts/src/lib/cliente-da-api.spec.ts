import '@angular/compiler';
import {
  HttpClient,
  type HttpEvent,
  type HttpHandler,
  type HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import {
  createEnvironmentInjector,
  type EnvironmentInjector,
  Injector,
  type Provider,
  ɵINJECTOR_SCOPE,
} from '@angular/core';
import { firstValueFrom, type Observable, of } from 'rxjs';
import { criarClienteDaApi, type Schemas } from './cliente-da-api';

function clienteComResposta(corpo: unknown) {
  const requisicoes: Array<HttpRequest<unknown>> = [];
  const handler: HttpHandler = {
    handle(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
      requisicoes.push(req);
      return of(new HttpResponse({ status: 200, body: corpo }));
    },
  };
  return { cliente: criarClienteDaApi(new HttpClient(handler), 'http://api.test'), requisicoes };
}

describe('cliente da API', () => {
  const identidade: Schemas['IdentidadeDoTenantDto'] = {
    nome: 'Academia Ritmo',
    corDestaque: '#22C98A',
    logotipoUrl: null,
  };

  it('faz GET no caminho do contrato e devolve o corpo tipado', async () => {
    const { cliente, requisicoes } = clienteComResposta(identidade);

    const resposta = await firstValueFrom(cliente.get('/api/public/tenant'));

    expect(resposta.nome).toBe('Academia Ritmo');
    expect(requisicoes[0]?.method).toBe('GET');
    expect(requisicoes[0]?.url).toBe('http://api.test/api/public/tenant');
  });

  it('faz PUT com o corpo do contrato', async () => {
    const { cliente, requisicoes } = clienteComResposta(identidade);

    await firstValueFrom(cliente.put('/api/tenant/identidade', identidade));

    expect(requisicoes[0]?.method).toBe('PUT');
    expect(requisicoes[0]?.body).toEqual(identidade);
  });
});

// Os caminhos abaixo são só para exercitar a montagem da URL: o contrato atual não tem rota com
// parâmetro de caminho, então o cliente é usado sem a tipagem.
type ClienteSolto = Record<
  'get' | 'post' | 'put' | 'patch' | 'delete',
  (...args: unknown[]) => Observable<unknown>
>;

describe('montagem da URL e métodos', () => {
  const solto = (corpo: unknown = {}) => {
    const { cliente, requisicoes } = clienteComResposta(corpo);
    return { cliente: cliente as unknown as ClienteSolto, requisicoes };
  };

  it.each(['post', 'put', 'patch'] as const)('envia o corpo no %s', async (metodo) => {
    const { cliente, requisicoes } = solto();

    await firstValueFrom(cliente[metodo]('/api/x', { a: 1 }));

    expect(requisicoes[0]?.method).toBe(metodo.toUpperCase());
    expect(requisicoes[0]?.body).toEqual({ a: 1 });
  });

  it('faz DELETE sem corpo', async () => {
    const { cliente, requisicoes } = solto();

    await firstValueFrom(cliente.delete('/api/x'));

    expect(requisicoes[0]?.method).toBe('DELETE');
    expect(requisicoes[0]?.body).toBeNull();
  });

  it('substitui parâmetros de caminho com encodeURIComponent', async () => {
    const { cliente, requisicoes } = solto();

    await firstValueFrom(
      cliente.get('/api/alunos/{id}/notas/{n}', { caminho: { id: 'a b/c', n: 2 } }),
    );

    expect(requisicoes[0]?.url).toBe('http://api.test/api/alunos/a%20b%2Fc/notas/2');
  });

  it('falha quando falta um parâmetro de caminho', () => {
    const { cliente } = solto();

    expect(() => cliente.get('/api/alunos/{id}', { caminho: {} })).toThrow(/"id" ausente/);
    expect(() => cliente.get('/api/alunos/{id}')).toThrow(/"id" ausente/);
  });

  it('envia a consulta sem os valores vazios', async () => {
    const { cliente, requisicoes } = solto();

    await firstValueFrom(
      cliente.get('/api/x', { consulta: { q: 'ana', pagina: 2, nada: undefined, nulo: null } }),
    );

    expect(requisicoes[0]?.params.get('q')).toBe('ana');
    expect(requisicoes[0]?.params.get('pagina')).toBe('2');
    expect(requisicoes[0]?.params.has('nada')).toBe(false);
    expect(requisicoes[0]?.params.has('nulo')).toBe(false);
  });

  it('sem consulta útil não envia parâmetros', async () => {
    const { cliente, requisicoes } = solto();

    await firstValueFrom(cliente.get('/api/x', { consulta: { nada: undefined } }));

    expect(requisicoes[0]?.params.keys()).toEqual([]);
  });
});

// Injetor com escopo "root", para resolver os tokens `providedIn: 'root'` sem DOM nem TestBed.
const raiz = (providers: Provider[]): EnvironmentInjector =>
  createEnvironmentInjector(
    [{ provide: ɵINJECTOR_SCOPE, useValue: 'root' }, ...providers],
    Injector.create({ providers: [] }) as EnvironmentInjector,
  );

describe('tokens de injeção', () => {
  it('CLIENTE_DA_API usa o HttpClient e a URL base do token', async () => {
    const { CLIENTE_DA_API, URL_BASE_DA_API } = await import('./cliente-da-api');
    const requisicoes: Array<HttpRequest<unknown>> = [];
    const handler: HttpHandler = {
      handle: (req) => {
        requisicoes.push(req);
        return of(new HttpResponse({ status: 200, body: {} }));
      },
    };
    const injector = raiz([
      { provide: HttpClient, useValue: new HttpClient(handler) },
      { provide: URL_BASE_DA_API, useValue: 'http://base.test' },
    ]);

    await firstValueFrom(
      (injector.get(CLIENTE_DA_API) as unknown as ClienteSolto).get(
        '/api/x',
      ) as Observable<unknown>,
    );

    expect(requisicoes[0]?.url).toBe('http://base.test/api/x');
  });

  it('URL_BASE_DA_API vale vazio por padrão', async () => {
    const { URL_BASE_DA_API } = await import('./cliente-da-api');
    expect(raiz([]).get(URL_BASE_DA_API)).toBe('');
  });
});
