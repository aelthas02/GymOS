import { Global, Module } from '@nestjs/common';
import { FabricasDeTeste } from './application/fabricas-de-teste';
import { FabricasDeTesteController } from './interface/http/fabricas-de-teste.controller';

/**
 * API de teste do E2E (T35). O AppModule só importa este módulo fora de produção; domínios que
 * precisam de fábricas injetam `FabricasDeTeste` com `@Optional()` e registram as suas.
 */
@Global()
@Module({
  controllers: [FabricasDeTesteController],
  providers: [FabricasDeTeste],
  exports: [FabricasDeTeste],
})
export class TesteModule {}
