import type { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';
import { GLOBAL_PREFIX } from '../../../app/configure-app';
import { LocalizadorDeAlunoPorCpf } from '../../autenticacao/application/portas';
import { AutenticacaoModule } from '../../autenticacao/autenticacao.module';
import {
  CONFIGURACAO_DA_AUTENTICACAO,
  type ConfiguracaoDaAutenticacao,
} from '../../autenticacao/infra/configuracao';
import { LocalizadorDeAlunoEmMemoria } from '../../autenticacao/infra/localizador-de-aluno';
import { CONFIGURACAO_DA_PLATAFORMA, type ConfiguracaoDaPlataforma } from '../infra/configuracao';
import {
  CONFIGURACAO_DA_CIFRA,
  type ConfiguracaoDaCifra,
} from '../infra/protecao-de-dados/configuracao';
import { AuditoriaModule } from '../auditoria.module';
import { PlatformModule } from '../platform.module';
import { ProtecaoDeDadosModule } from '../protecao-de-dados.module';
import type { BancoDeTeste } from './banco-de-teste';
import { CHAVE_MESTRA_DE_TESTE } from './protecao-de-dados-de-teste';

export const CHAVE_DE_OPERACAO_DE_TESTE = 'chave-de-operacao-de-teste-com-32-caracteres';
export const SEGREDO_DO_JWT_DE_TESTE = 'segredo-do-jwt-de-teste-com-32-caracteres';

export interface OpcoesDoAppDeTeste {
  /** Controllers só do teste (rotas com @RequirePermission ou @RequireModule de exemplo). */
  controllers?: Type[];
  autenticacao?: Partial<ConfiguracaoDaAutenticacao>;
}

// App Nest com a plataforma e a autenticação, ligado ao banco do arquivo de teste. E-mail fake,
// CPF do aluno em memória, chave mestra de teste e um prefixo de Redis próprio por app.
export async function criarAppDeTeste(
  banco: BancoDeTeste,
  configuracao: Partial<ConfiguracaoDaPlataforma> = {},
  opcoes: OpcoesDoAppDeTeste = {},
): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({
    imports: [PlatformModule, AutenticacaoModule, ProtecaoDeDadosModule, AuditoriaModule],
    controllers: opcoes.controllers ?? [],
  })
    .overrideProvider(CONFIGURACAO_DA_PLATAFORMA)
    .useValue({
      ambiente: 'test',
      urlDoBanco: banco.urlApp,
      dominioBase: 'localhost',
      chaveDeOperacao: CHAVE_DE_OPERACAO_DE_TESTE,
      urlDoPainel: 'http://{tenant}.localhost:4200',
      ...configuracao,
    } satisfies ConfiguracaoDaPlataforma)
    .overrideProvider(CONFIGURACAO_DA_AUTENTICACAO)
    .useValue({
      segredoDoJwt: SEGREDO_DO_JWT_DE_TESTE,
      urlDoRedis: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      prefixoDoRedis: `gymos-teste-${randomBytes(4).toString('hex')}`,
      urlDoApp: 'http://{tenant}.localhost:4300',
      transporteDeEmail: 'fake',
      smtp: { host: 'localhost', porta: 1025 },
      remetente: 'GymOS <teste@gymos.app>',
      ...opcoes.autenticacao,
    } satisfies ConfiguracaoDaAutenticacao)
    .overrideProvider(CONFIGURACAO_DA_CIFRA)
    .useValue({ chaveMestraLocal: CHAVE_MESTRA_DE_TESTE } satisfies ConfiguracaoDaCifra)
    .overrideProvider(LocalizadorDeAlunoPorCpf)
    .useClass(LocalizadorDeAlunoEmMemoria)
    .compile();
  const app = modulo.createNestApplication({
    logger: process.env['DEBUG_TESTE'] ? ['error'] : false,
  });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.init();
  banco.aoFinal(() => app.close());
  return app;
}
