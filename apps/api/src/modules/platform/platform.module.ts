import {
  Global,
  type MiddlewareConsumer,
  Module,
  type NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { AtualizarIdentidadeDoTenant, CriarAcademia } from './application/casos-de-uso';
import { PROVEDORES_DE_WEBHOOK, RepositorioDeTenants } from './application/portas';
import { Relogio } from './domain/relogio';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
  configuracaoDoAmbiente,
  permiteRecursosDeDesenvolvimento,
} from './infra/configuracao';
import { ContextoDoTenant } from './infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from './infra/contexto/executor-de-tenant';
import { PrismaService } from './infra/prisma/prisma.service';
import { RelogioDaRequisicao } from './infra/relogio/relogio';
import { RepositorioDeTenantsPrisma } from './infra/tenants/repositorio-de-tenants.prisma';
import { ProvedorDeWebhookFake } from './infra/webhooks/provedor-fake';
import { ContextoDaRequisicaoMiddleware } from './interface/http/contexto.middleware';
import { ChaveDeOperacaoGuard, InternoController } from './interface/http/interno.controller';
import { ResolucaoDeTenantMiddleware } from './interface/http/resolucao-de-tenant.middleware';
import { TenantController } from './interface/http/tenant.controller';
import { TransacaoPorRequisicaoInterceptor } from './interface/http/transacao.interceptor';
import { WebhooksController } from './interface/http/webhooks.controller';

/**
 * Rotas que não passam pela resolução do tenant por Host: saúde e métricas da plataforma, webhooks
 * (tenant no caminho ou no id externo), operação interna e a página de pagamento simulada.
 */
export const ROTAS_SEM_TENANT = [
  'health',
  'health/{*caminho}',
  'metrics',
  'webhooks/{*caminho}',
  'interno/{*caminho}',
  // Página de pagamento simulada do provedor fake (T19): o tenant vem do id externo da cobrança.
  'pagamento-simulado/{*caminho}',
];

/**
 * Transversal do back: tenant, contexto e transação por requisição, runAsTenant e Relogio. O
 * ConviteDoAdministrador vem do módulo de autenticação (T12), também global.
 */
@Global()
@Module({
  controllers: [TenantController, WebhooksController, InternoController],
  providers: [
    {
      provide: CONFIGURACAO_DA_PLATAFORMA,
      useFactory: (env: Env): ConfiguracaoDaPlataforma => configuracaoDoAmbiente(env),
      inject: [ENV],
    },
    PrismaService,
    ContextoDoTenant,
    ExecutorDeTenant,
    { provide: RepositorioDeTenants, useClass: RepositorioDeTenantsPrisma },
    { provide: Relogio, useClass: RelogioDaRequisicao },
    ProvedorDeWebhookFake,
    {
      provide: PROVEDORES_DE_WEBHOOK,
      useFactory: (config: ConfiguracaoDaPlataforma, fake: ProvedorDeWebhookFake) =>
        permiteRecursosDeDesenvolvimento(config) ? [fake] : [],
      inject: [CONFIGURACAO_DA_PLATAFORMA, ProvedorDeWebhookFake],
    },
    AtualizarIdentidadeDoTenant,
    CriarAcademia,
    ChaveDeOperacaoGuard,
    { provide: APP_INTERCEPTOR, useClass: TransacaoPorRequisicaoInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    },
  ],
  exports: [
    // O EventosModule usa a chave de operação (painel de filas e reprocessamento da DLQ).
    CONFIGURACAO_DA_PLATAFORMA,
    ChaveDeOperacaoGuard,
    ContextoDoTenant,
    ExecutorDeTenant,
    Relogio,
    CriarAcademia,
    RepositorioDeTenants,
    // Domínios com provedor de webhook próprio (pagamentos, T19) entram na lista ao iniciar.
    PROVEDORES_DE_WEBHOOK,
    // Só para a sonda de prontidão do Postgres (observabilidade), que usa o pool da API.
    PrismaService,
  ],
})
export class PlatformModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextoDaRequisicaoMiddleware).forRoutes('{*caminho}');
    consumer
      .apply(ResolucaoDeTenantMiddleware)
      .exclude(...ROTAS_SEM_TENANT)
      .forRoutes('{*caminho}');
  }
}
