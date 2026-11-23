import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { correlationIdInterceptor } from './correlation-id.interceptor';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('correlationIdInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([correlationIdInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  function sentHeader(url: string, headers?: HttpHeaders): string | null {
    http.get(url, { headers }).subscribe();
    const request = backend.expectOne(url);
    request.flush({});
    return request.request.headers.get('x-correlation-id');
  }

  it('adiciona o cabeçalho x-correlation-id com um UUID', () => {
    expect(sentHeader('/api/alunos')).toMatch(UUID_V4);
  });

  it('gera um valor novo por requisição', () => {
    expect(sentHeader('/api/alunos')).not.toBe(sentHeader('/api/alunos'));
  });

  it('mantém o valor quando a chamada já define o cabeçalho', () => {
    const headers = new HttpHeaders({ 'x-correlation-id': 'fluxo-7' });

    expect(sentHeader('/api/alunos', headers)).toBe('fluxo-7');
  });

  it('envia também para URLs absolutas da mesma origem', () => {
    expect(sentHeader(`${location.origin}/api/alunos`)).toMatch(UUID_V4);
  });

  it('envia para URL relativa sem barra inicial', () => {
    expect(sentHeader('api/alunos')).toMatch(UUID_V4);
  });

  it('não envia para a mesma máquina em outra porta (origem diferente)', () => {
    const outraPorta = new URL(location.origin);
    outraPorta.port = String(Number(outraPorta.port || 80) + 1);

    expect(sentHeader(`${outraPorta.origin}/api/alunos`)).toBeNull();
  });

  it('não envia para outras origens, para não disparar preflight de CORS', () => {
    expect(sentHeader('https://bucket.s3.amazonaws.com/upload')).toBeNull();
    expect(sentHeader('//cdn.example.com/arquivo.js')).toBeNull();
  });

  it('gera o UUID sem crypto.randomUUID (página servida por http num IP da rede)', () => {
    // Fora de contexto seguro (https ou localhost) o navegador não define randomUUID.
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    try {
      expect(sentHeader('/api/alunos')).toMatch(UUID_V4);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
