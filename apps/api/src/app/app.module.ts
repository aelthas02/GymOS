import { Module } from '@nestjs/common';
import { PlatformModule } from '../modules/platform/platform.module';
import { EventosModule } from '../modules/platform/eventos.module';
import { EnvModule } from '../config/env.module';
import { ObservabilidadeModule } from '../observabilidade/observabilidade.module';

@Module({
  imports: [EnvModule, ObservabilidadeModule, PlatformModule, EventosModule],
})
export class AppModule {}
