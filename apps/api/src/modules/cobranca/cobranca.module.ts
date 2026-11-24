import { Inject, Module, type OnModuleInit } from '@nestjs/common';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { RegistroDeAtividade } from '../alunos/application/autoria';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { PROVEDORES_DE_WEBHOOK, type ProvedorDeWebhook } from '../platform/application/portas';
import type { DataCivil } from '../platform/domain/relogio';
import { RegistroDeConsumidores } from '../platform/infra/eventos/registro-de-consumidores';
import { Pagamentos } from './application/pagamentos';
import { Parcelas } from './application/parcelas';
import {
  AlunosDaCobranca,
  GatewayDePagamento,
  Mensageria,
  ReferenciasExternas,
  RepositorioDeCobrancas,
  RepositorioDeEstornos,
  RepositorioDeFormasDePagamento,
  RepositorioDePagamentos,
  RepositorioDeParcelas,
} from './application/portas';
import {
  DadosDoTitularDaCobranca,
  MensageriaPendente,
  RotinaDosAtrasos,
  WebhookDePagamentos,
} from './infra/adapters';
import { CONFIGURACAO_DOS_PAGAMENTOS, configuracaoDosPagamentos } from './infra/configuracao';
import { GatewayDePagamentoFake } from './infra/gateway.fake';
import {
  AlunosDaCobrancaPrisma,
  ReferenciasExternasPrisma,
  RepositorioDeCobrancasPrisma,
  RepositorioDeEstornosPrisma,
  RepositorioDeFormasDePagamentoPrisma,
  RepositorioDePagamentosPrisma,
  RepositorioDeParcelasPrisma,
} from './infra/repositorios.prisma';
import { CobrancaController, CobrancaDoAppController } from './interface/http/cobranca.controller';
import { PagamentoSimuladoController } from './interface/http/pagamento-simulado.controller';

/**
 * Cobrança e pagamentos (T19, ADR-009 e ADR-018): gera as parcelas a cada ContratoCriado e
 * ContratoRenovado, suspende e reprograma no trancamento, recebe pagamentos (balcão e webhook do
 * provedor) e estornos, e é a única fonte do atraso. Exporta `Parcelas` para a porta
 * `ParcelasDoContrato` do domínio alunos e `Pagamentos` para o `{link}` da Mensageria (T13d).
 */
@Module({
  controllers: [CobrancaController, CobrancaDoAppController, PagamentoSimuladoController],
  providers: [
    {
      provide: CONFIGURACAO_DOS_PAGAMENTOS,
      useFactory: (env?: Env) => configuracaoDosPagamentos(env),
      inject: [{ token: ENV, optional: true }],
    },
    GatewayDePagamentoFake,
    // Só o fake até o provedor real ser escolhido (PAGAMENTOS_PROVEDOR).
    { provide: GatewayDePagamento, useExisting: GatewayDePagamentoFake },
    { provide: Mensageria, useClass: MensageriaPendente },
    { provide: RepositorioDeParcelas, useClass: RepositorioDeParcelasPrisma },
    { provide: RepositorioDeCobrancas, useClass: RepositorioDeCobrancasPrisma },
    { provide: RepositorioDePagamentos, useClass: RepositorioDePagamentosPrisma },
    { provide: RepositorioDeEstornos, useClass: RepositorioDeEstornosPrisma },
    { provide: RepositorioDeFormasDePagamento, useClass: RepositorioDeFormasDePagamentoPrisma },
    { provide: AlunosDaCobranca, useClass: AlunosDaCobrancaPrisma },
    { provide: ReferenciasExternas, useClass: ReferenciasExternasPrisma },
    RegistroDeAtividade,
    Parcelas,
    Pagamentos,
    WebhookDePagamentos,
    DadosDoTitularDaCobranca,
    RotinaDosAtrasos,
  ],
  exports: [Parcelas, Pagamentos, RotinaDosAtrasos, RepositorioDeParcelas, RepositorioDePagamentos],
})
export class CobrancaModule implements OnModuleInit {
  constructor(
    private readonly consumidores: RegistroDeConsumidores,
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDaCobranca,
    private readonly parcelas: Parcelas,
    private readonly webhook: WebhookDePagamentos,
    @Inject(PROVEDORES_DE_WEBHOOK) private readonly provedores: ProvedorDeWebhook[],
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
    if (!this.provedores.some((provedor) => provedor.nome === this.webhook.nome)) {
      this.provedores.push(this.webhook);
    }
    this.consumidores.registrar({
      nome: 'cobranca.gerar-parcelas',
      evento: 'ContratoCriado',
      fila: 'cobranca',
      tratar: async ({ payload }) => {
        await this.parcelas.gerar({
          contratoId: payload.contratoId,
          alunoId: payload.alunoId,
          inicio: payload.inicio as DataCivil,
          valorEmCentavos: payload.valorEmCentavos,
          parcelas: payload.parcelas,
        });
      },
    });
    this.consumidores.registrar({
      nome: 'cobranca.gerar-parcelas-da-renovacao',
      evento: 'ContratoRenovado',
      fila: 'cobranca',
      tratar: async ({ payload }) => {
        await this.parcelas.gerar({
          contratoId: payload.contratoId,
          alunoId: payload.alunoId,
          inicio: payload.novoInicio as DataCivil,
          valorEmCentavos: payload.valorEmCentavos,
          parcelas: payload.parcelas,
        });
      },
    });
    this.consumidores.registrar({
      nome: 'cobranca.suspender-parcelas',
      evento: 'ContratoTrancado',
      fila: 'cobranca',
      tratar: async ({ payload }) => {
        await this.parcelas.suspender(payload.contratoId, payload.inicio as DataCivil);
      },
    });
    this.consumidores.registrar({
      nome: 'cobranca.reprogramar-parcelas',
      evento: 'ContratoDestrancado',
      fila: 'cobranca',
      tratar: async ({ payload }) => {
        await this.parcelas.reprogramar(payload.contratoId, payload.destrancadoEm as DataCivil);
      },
    });
  }
}
