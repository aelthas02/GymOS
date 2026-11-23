import '@angular/compiler';
import {
  HttpClient,
  type HttpEvent,
  type HttpHandler,
  type HttpRequest,
  HttpResponse,
} from '@angular/common/http';
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
