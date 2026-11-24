import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  Optional,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Auditoria } from '../../application/auditoria';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';
import { CONFIGURACAO_DAS_FILAS, type ConfiguracaoDasFilas } from '../filas/configuracao-das-filas';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Retenção de 12 meses (T13b): um runAsTenant por academia, na transação do próprio tenant. A falha
 * de um tenant não impede os outros (`paraCadaTenant`). Com `FILAS_PROCESSAR`, o processo roda a
 * limpeza ao subir e a cada 24 h; é idempotente, então réplicas concorrentes só repetem o DELETE.
 */
@Injectable()
export class LimpezaDaAuditoria implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LimpezaDaAuditoria.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly auditoria: Auditoria,
    @Optional()
    @Inject(CONFIGURACAO_DAS_FILAS)
    private readonly filas?: ConfiguracaoDasFilas,
  ) {}

  /** Remove os registros vencidos de todos os tenants e devolve o total removido. */
  async executar(): Promise<number> {
    const removidos = await this.executor.paraCadaTenant(() => this.auditoria.removerExpiradas());
    return removidos.reduce((total, quantos) => total + quantos, 0);
  }

  onApplicationBootstrap(): void {
    if (!this.filas?.processar) {
      return;
    }
    const rodar = (): void => {
      this.executar().then(
        (total) => this.logger.log({ total }, 'Retenção do log de atividades executada'),
        (err: unknown) => this.logger.error({ err }, 'Falha na retenção do log de atividades'),
      );
    };
    rodar();
    this.temporizador = setInterval(rodar, UM_DIA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }
}
