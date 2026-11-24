import { canalDoTenant, TopicoInvalidoError } from '../tempo-real/tempo-real.redis';
import { ChaveDeCacheInvalidaError, chaveDeCache } from './chave-de-cache';

describe('chaveDeCache', () => {
  it('monta tenant:<id>:cache:<partes>', () => {
    expect(chaveDeCache('t1', 'resumo', 42, 'a.b-c_d')).toBe('tenant:t1:cache:resumo:42:a.b-c_d');
  });

  it.each([null, undefined, ''])('recusa tenant %j', (tenant) => {
    expect(() => chaveDeCache(tenant, 'x')).toThrow(ChaveDeCacheInvalidaError);
  });

  it('recusa chave sem partes', () => {
    expect(() => chaveDeCache('t1')).toThrow(/sem partes/);
  });

  it.each(['a:b', '*', 'a b', '', 'a/b', 'a?'])('recusa a parte "%s"', (parte) => {
    expect(() => chaveDeCache('t1', parte)).toThrow(ChaveDeCacheInvalidaError);
  });
});

describe('canalDoTenant', () => {
  it('monta <prefixo>:tenant:<id>:<topico>', () => {
    expect(canalDoTenant('gymos', 't1', 'recepcao.checkin')).toBe(
      'gymos:tenant:t1:recepcao.checkin',
    );
  });

  it.each(['Recepcao', 'a:b', 'a*', '', '.a', 'a..b'])('recusa o tópico "%s"', (topico) => {
    expect(() => canalDoTenant('gymos', 't1', topico)).toThrow(TopicoInvalidoError);
  });
});
