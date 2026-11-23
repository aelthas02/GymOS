import { Module } from '@nestjs/common';
import { EnvModule } from '../config/env.module';
import { ObservabilidadeModule } from '../observabilidade/observabilidade.module';

@Module({
  imports: [EnvModule, ObservabilidadeModule],
})
export class AppModule {}
