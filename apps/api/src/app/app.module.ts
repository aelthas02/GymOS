import { Module } from '@nestjs/common';
import { AlunosModule } from '../modules/alunos/alunos.module';
import { AuditoriaModule } from '../modules/platform/auditoria.module';
import { AutenticacaoModule } from '../modules/autenticacao/autenticacao.module';
import { PlatformModule } from '../modules/platform/platform.module';
import { TesteModule } from '../modules/platform/teste.module';
import { EventosModule } from '../modules/platform/eventos.module';
import { ProtecaoDeDadosModule } from '../modules/platform/protecao-de-dados.module';
import { EnvModule } from '../config/env.module';
import { ObservabilidadeModule } from '../observabilidade/observabilidade.module';

@Module({
  imports: [
    EnvModule,
    ObservabilidadeModule,
    PlatformModule,
    AutenticacaoModule,
    EventosModule,
    ProtecaoDeDadosModule,
    AuditoriaModule,
    AlunosModule,
    // API de teste do E2E (T35): fora de produção só.
    ...(process.env['NODE_ENV'] === 'production' || process.env['APP_ENV'] === 'production'
      ? []
      : [TesteModule]),
  ],
})
export class AppModule {}
