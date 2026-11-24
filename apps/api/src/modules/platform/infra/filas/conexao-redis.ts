import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CONFIGURACAO_DAS_FILAS, type ConfiguracaoDasFilas } from './configuracao-das-filas';

/**
 * Conexões da plataforma com o Redis, abertas só no primeiro uso: um processo que não usa fila, cache
 * nem tempo real não conecta. O lint proíbe o cliente Redis fora de `modules/platform`.
 */
@Injectable()
export class ConexaoRedis implements OnModuleDestroy {
  private readonly logger = new Logger(ConexaoRedis.name);
  private comandos?: Redis;
  private assinaturas?: Redis;

  constructor(@Inject(CONFIGURACAO_DAS_FILAS) private readonly config: ConfiguracaoDasFilas) {}

  get prefixo(): string {
    return this.config.prefixo;
  }

  /** Conexão de comandos, compartilhada por filas e cache (o BullMQ exige maxRetriesPerRequest nulo). */
  cliente(): Redis {
    this.comandos ??= this.abrir('comandos');
    return this.comandos;
  }

  /** Conexão dedicada às assinaturas de pub/sub, que não aceita outros comandos. */
  assinante(): Redis {
    this.assinaturas ??= this.abrir('assinaturas');
    return this.assinaturas;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [this.comandos, this.assinaturas].map((conexao) => conexao?.quit().catch(() => undefined)),
    );
  }

  private abrir(papel: string): Redis {
    const conexao = new Redis(this.config.urlDoRedis, { maxRetriesPerRequest: null });
    conexao.on('error', (err) => this.logger.warn({ err, papel }, 'Falha na conexão com o Redis'));
    return conexao;
  }
}
