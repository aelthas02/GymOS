import {
  Global,
  Inject,
  Module,
  type OnApplicationBootstrap,
  type OnModuleInit,
  Optional,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import {
  CacheComTenant,
  FILAS,
  Filas,
  PublicadorDeEventos,
  TempoRealPorTenant,
} from './application/eventos';
import { CacheComTenantRedis } from './infra/cache/cache-com-tenant.redis';
import { CONFIGURACAO_DA_PLATAFORMA, type ConfiguracaoDaPlataforma } from './infra/configuracao';
import { DespachanteDoOutbox } from './infra/eventos/despachante-do-outbox';
import { EntregaDeEventos } from './infra/eventos/entrega-de-eventos';
import { PublicadorDeEventosOutbox } from './infra/eventos/publicador-outbox';
import { RegistroDeConsumidores } from './infra/eventos/registro-de-consumidores';
import { ConexaoRedis } from './infra/filas/conexao-redis';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
  configuracaoDasFilas,
} from './infra/filas/configuracao-das-filas';
import { FILA_DE_FALHAS, FilasBullMQ } from './infra/filas/filas.bullmq';
import { ProcessadorDeFilas } from './infra/filas/processador-de-filas';
import { TempoRealRedis } from './infra/tempo-real/tempo-real.redis';
import { FalhasController } from './interface/http/falhas.controller';
import {
  CAMINHO_DO_PAINEL,
  protecaoDoPainel,
  routerDoPainel,
} from './interface/http/painel-de-filas';

/**
 * Eventos de domínio (outbox), filas BullMQ, cache e tempo real por tenant (ADR-007, T13a). Com
 * FILAS_PROCESSAR, o processo sobe um worker por fila e o despachante do outbox.
 */
@Global()
@Module({
  controllers: [FalhasController],
  providers: [
    {
      provide: CONFIGURACAO_DAS_FILAS,
      useFactory: (env: Env): ConfiguracaoDasFilas => configuracaoDasFilas(env),
      inject: [ENV],
    },
    ConexaoRedis,
    FilasBullMQ,
    { provide: Filas, useExisting: FilasBullMQ },
    RegistroDeConsumidores,
    EntregaDeEventos,
    ProcessadorDeFilas,
    DespachanteDoOutbox,
    { provide: PublicadorDeEventos, useClass: PublicadorDeEventosOutbox },
    { provide: CacheComTenant, useClass: CacheComTenantRedis },
    { provide: TempoRealPorTenant, useClass: TempoRealRedis },
  ],
  exports: [
    Filas,
    PublicadorDeEventos,
    CacheComTenant,
    TempoRealPorTenant,
    RegistroDeConsumidores,
    ProcessadorDeFilas,
  ],
})
export class EventosModule implements OnModuleInit, OnApplicationBootstrap {
  constructor(
    @Inject(CONFIGURACAO_DAS_FILAS) private readonly config: ConfiguracaoDasFilas,
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly plataforma: ConfiguracaoDaPlataforma,
    private readonly filas: FilasBullMQ,
    private readonly processador: ProcessadorDeFilas,
    private readonly despachante: DespachanteDoOutbox,
    @Optional() private readonly http?: HttpAdapterHost,
  ) {}

  /** Painel só em dev e staging, e só com a chave de operação configurada. */
  onModuleInit(): void {
    const servidor = this.http?.httpAdapter?.getInstance?.() as
      { use(caminho: string, ...handlers: unknown[]): void } | undefined;
    const chave = this.plataforma.chaveDeOperacao;
    if (!this.config.painel || !chave || typeof servidor?.use !== 'function') {
      return;
    }
    const filas = [...FILAS.map((nome) => this.filas.fila(nome)), this.filas.fila(FILA_DE_FALHAS)];
    servidor.use(CAMINHO_DO_PAINEL, protecaoDoPainel(chave), routerDoPainel(filas));
  }

  onApplicationBootstrap(): void {
    if (!this.config.processar) {
      return;
    }
    this.filas.fila(FILA_DE_FALHAS);
    for (const fila of FILAS) {
      this.processador.iniciarWorker(fila);
    }
    this.despachante.iniciar();
  }
}
