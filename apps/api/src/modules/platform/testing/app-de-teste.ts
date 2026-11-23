import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GLOBAL_PREFIX } from '../../../app/configure-app';
import { CONFIGURACAO_DA_PLATAFORMA, type ConfiguracaoDaPlataforma } from '../infra/configuracao';
import { PlatformModule } from '../platform.module';
import type { BancoDeTeste } from './banco-de-teste';

export const CHAVE_DE_OPERACAO_DE_TESTE = 'chave-de-operacao-de-teste-com-32-caracteres';

// App Nest só com o módulo da plataforma, ligado ao banco do arquivo de teste.
export async function criarAppDeTeste(
  banco: BancoDeTeste,
  configuracao: Partial<ConfiguracaoDaPlataforma> = {},
): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ imports: [PlatformModule] })
    .overrideProvider(CONFIGURACAO_DA_PLATAFORMA)
    .useValue({
      ambiente: 'test',
      urlDoBanco: banco.urlApp,
      dominioBase: 'localhost',
      chaveDeOperacao: CHAVE_DE_OPERACAO_DE_TESTE,
      urlDoPainel: 'http://{tenant}.localhost:4200',
      ...configuracao,
    } satisfies ConfiguracaoDaPlataforma)
    .compile();
  const app = modulo.createNestApplication({ logger: false });
  app.setGlobalPrefix(GLOBAL_PREFIX);
  await app.init();
  banco.aoFinal(() => app.close());
  return app;
}
