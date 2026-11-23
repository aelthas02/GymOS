import { Module } from '@nestjs/common';
import { PlatformModule } from '../modules/platform/platform.module';
import { EnvModule } from '../config/env.module';
import { ObservabilidadeModule } from '../observabilidade/observabilidade.module';

@Module({
  imports: [EnvModule, ObservabilidadeModule, PlatformModule],
})
export class AppModule {}
