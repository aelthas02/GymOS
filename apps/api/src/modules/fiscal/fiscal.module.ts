import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { RegistroDeAtividade } from '../alunos/application/autoria';
import { CobrancaModule } from '../cobranca/cobranca.module';
import { IntegracoesModule } from '../integracoes/integracoes.module';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { PROVEDORES_DE_WEBHOOK, type ProvedorDeWebhook } from '../platform/application/portas';
import { RegistroDeConsumidores } from '../platform/infra/eventos/registro-de-consumidores';
import { ProcessadorDeFilas } from '../platform/infra/filas/processador-de-filas';
import { ConfiguracaoFiscal } from './application/dados-fiscais';
import { ExportacaoParaOContador } from './application/exportacao';
import { NotasFiscais } from './application/notas-fiscais';
import {
  AlunosDoFiscal,
  CobrancaDoFiscal,
  EmissorFiscal,
  FilaDasNotas,
  RepositorioDaConfiguracaoFiscal,
  RepositorioDeNotas,
} from './application/portas';
import {
  DadosDoTitularDoFiscal,
  FilaDasNotasBullMQ,
  JOB_DE_CONFERENCIA,
  JOB_DE_EMISSAO,
  RotinaDoLoteFiscal,
  WebhookDoEmissorFiscal,
} from './infra/adapters';
import { CONFIGURACAO_DO_FISCAL, configuracaoDoFiscal } from './infra/configuracao';
import { EmissorFiscalFake } from './infra/emissor.fake';
import {
  AlunosDoFiscalPrisma,
  CobrancaDoFiscalAdapter,
  RepositorioDaConfiguracaoFiscalPrisma,
  RepositorioDeNotasPrisma,
} from './infra/repositorios.prisma';
import {
  DadosFiscaisController,
  NotasFiscaisController,
} from './interface/http/notas-fiscais.controller';

/**
 * Notas fiscais (T20, ADR-008): NFS-e para mensalidades e serviços e NFC-e para a Loja, por um emissor
 * terceirizado atrás da porta `EmissorFiscal` (só o fake até o fornecedor ser escolhido). Consome
 * PagamentoConfirmado (emite conforme "Quando emitir") e PagamentoEstornado (cancela a nota).
 */
@Module({
  imports: [CobrancaModule, IntegracoesModule],
  controllers: [NotasFiscaisController, DadosFiscaisController],
  providers: [
    {
      provide: CONFIGURACAO_DO_FISCAL,
      useFactory: (env?: Env) => configuracaoDoFiscal(env),
      inject: [{ token: ENV, optional: true }],
    },
    EmissorFiscalFake,
    // Só o fake até o fornecedor ser escolhido (FISCAL_PROVEDOR).
    { provide: EmissorFiscal, useExisting: EmissorFiscalFake },
    { provide: RepositorioDeNotas, useClass: RepositorioDeNotasPrisma },
    { provide: RepositorioDaConfiguracaoFiscal, useClass: RepositorioDaConfiguracaoFiscalPrisma },
    { provide: AlunosDoFiscal, useClass: AlunosDoFiscalPrisma },
    { provide: CobrancaDoFiscal, useClass: CobrancaDoFiscalAdapter },
    { provide: FilaDasNotas, useClass: FilaDasNotasBullMQ },
    RegistroDeAtividade,
    NotasFiscais,
    ConfiguracaoFiscal,
    ExportacaoParaOContador,
    WebhookDoEmissorFiscal,
    DadosDoTitularDoFiscal,
    RotinaDoLoteFiscal,
  ],
  exports: [NotasFiscais, ConfiguracaoFiscal, RotinaDoLoteFiscal, RepositorioDeNotas],
})
export class FiscalModule implements OnModuleInit {
  constructor(
    private readonly consumidores: RegistroDeConsumidores,
    private readonly processador: ProcessadorDeFilas,
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDoFiscal,
    private readonly notas: NotasFiscais,
    private readonly webhook: WebhookDoEmissorFiscal,
    @Inject(PROVEDORES_DE_WEBHOOK) private readonly provedores: ProvedorDeWebhook[],
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
    if (!this.provedores.some((provedor) => provedor.nome === this.webhook.nome)) {
      this.provedores.push(this.webhook);
    }
    this.consumidores.registrar({
      nome: 'fiscal.emitir-nota',
      evento: 'PagamentoConfirmado',
      fila: 'notas',
      tratar: async (evento) => {
        await this.notas.registrarDoPagamento(evento.tenantId, evento.payload);
      },
    });
    this.consumidores.registrar({
      nome: 'fiscal.cancelar-nota',
      evento: 'PagamentoEstornado',
      fila: 'notas',
      tratar: async ({ payload }) => {
        await this.notas.aoEstornar(payload);
      },
    });
    for (const job of [JOB_DE_EMISSAO, JOB_DE_CONFERENCIA]) {
      this.processador.registrarTrabalho<{ tenantId: string; notaId: string }>(
        'notas',
        job,
        async (dados) => {
          await this.notas.processar(dados.notaId);
        },
      );
    }
  }
}
