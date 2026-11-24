import type { Env } from '../../../../config/env';
import { CONFIGURACAO_DA_CIFRA, type ConfiguracaoDaCifra } from './configuracao';
import { provedorDeChaves, ProtecaoDeDadosModule } from '../../protecao-de-dados.module';
import { configuracaoDaCifra, ProvedorDeChavesIndisponivelError } from './configuracao';
import { ProvedorDeChavesLocal } from './provedor-de-chaves.local';

const CHAVE = Buffer.alloc(32, 3).toString('base64');
const env = (parcial: Partial<Env>) => parcial as Env;

describe('configuracaoDaCifra', () => {
  it('recusa a chave mestra local em produção', () => {
    expect(() =>
      configuracaoDaCifra(env({ APP_ENV: 'production', CHAVE_MESTRA_LOCAL: CHAVE })),
    ).toThrow(ProvedorDeChavesIndisponivelError);
  });

  it.each(['development', 'staging'] as const)('aceita a chave local em %s', (APP_ENV) => {
    expect(configuracaoDaCifra(env({ APP_ENV, CHAVE_MESTRA_LOCAL: CHAVE }))).toEqual({
      chaveMestraLocal: CHAVE,
    });
  });

  it('produção sem chave local passa (o KMS cuida)', () => {
    expect(configuracaoDaCifra(env({ APP_ENV: 'production' }))).toEqual({
      chaveMestraLocal: undefined,
    });
  });
});

describe('provedorDeChaves', () => {
  it('com chave local devolve o provedor local', () => {
    expect(provedorDeChaves({ chaveMestraLocal: CHAVE })).toBeInstanceOf(ProvedorDeChavesLocal);
  });

  it('sem chave lança ProvedorDeChavesIndisponivelError', () => {
    expect(() => provedorDeChaves({ chaveMestraLocal: undefined })).toThrow(
      ProvedorDeChavesIndisponivelError,
    );
    expect(() => provedorDeChaves({ chaveMestraLocal: '' })).toThrow(
      ProvedorDeChavesIndisponivelError,
    );
  });
});

describe('fábrica da configuração no módulo', () => {
  it('usa configuracaoDaCifra sobre o env injetado', () => {
    const providers: Array<{ provide?: unknown; useFactory?: (env: Env) => ConfiguracaoDaCifra }> =
      Reflect.getMetadata('providers', ProtecaoDeDadosModule);
    const fabrica = providers.find((p) => p.provide === CONFIGURACAO_DA_CIFRA)?.useFactory;

    expect(fabrica?.(env({ APP_ENV: 'development', CHAVE_MESTRA_LOCAL: CHAVE }))).toEqual({
      chaveMestraLocal: CHAVE,
    });
    expect(() => fabrica?.(env({ APP_ENV: 'production', CHAVE_MESTRA_LOCAL: CHAVE }))).toThrow(
      ProvedorDeChavesIndisponivelError,
    );
  });
});
