import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/prisma/client';
import { adaptadorPg } from './criar-cliente';
import { CONFIGURACAO_DA_PLATAFORMA, type ConfiguracaoDaPlataforma } from '../configuracao';

/**
 * Cliente global, conectado como gymos_app. Só a plataforma o usa: para as funções gymos_* e para
 * abrir a transação do tenant. Repositórios de domínio usam `ContextoDoTenant.cliente()`; o lint
 * proíbe importar este arquivo fora de `modules/platform`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(CONFIGURACAO_DA_PLATAFORMA) config: ConfiguracaoDaPlataforma) {
    super({ adapter: adaptadorPg(config.urlDoBanco) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
