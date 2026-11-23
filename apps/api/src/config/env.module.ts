import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env';

/** Token das variáveis de ambiente validadas (`Env`); o `main.ts` já recusou um ambiente inválido. */
export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv(process.env) }],
  exports: [ENV],
})
export class EnvModule {}
