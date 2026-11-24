import { Global, Inject, Module, type OnModuleInit } from '@nestjs/common';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { RegistroDeAtividade } from '../alunos/application/autoria';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { PROVEDORES_DE_WEBHOOK, type ProvedorDeWebhook } from '../platform/application/portas';
import { Relogio } from '../platform/domain/relogio';
import { Armazenamento } from './application/armazenamento';
import { ConexoesMeta } from './application/conexoes-meta';
import { GeradorIA } from './application/gerador-ia';
import { DiretorioDeAlunos, Mensageria } from './application/mensageria';
import {
  AssinadorDoFluxo,
  ObjetosDeArmazenamento,
  ProvedorDeIA,
  ProvedorMeta,
  RepositorioDeConexoes,
  RepositorioDeMensagens,
  RepositorioDeUsoDeIA,
  TenantDoContexto,
  TransporteDeWhatsapp,
} from './application/portas';
import { RegistroDeVariaveis, ResolvedorDeVariaveis } from './application/resolvedor';
import {
  DadosDoTitularDasIntegracoes,
  RenovacaoDosTokensDaMeta,
  WebhookDoWhatsapp,
} from './infra/adapters';
import {
  CONFIGURACAO_DAS_INTEGRACOES,
  type ConfiguracaoDasIntegracoes,
  configuracaoDasIntegracoes,
} from './infra/configuracao';
import { ProvedorDeIAFake } from './infra/ia.fake';
import { AssinadorDoFluxoHmac, ProvedorMetaFake, TenantDoContextoAtual } from './infra/meta.fake';
import { ObjetosDeArmazenamentoFake } from './infra/objetos.fake';
import { ObjetosDeArmazenamentoS3 } from './infra/objetos.s3';
import {
  RepositorioDeConexoesPrisma,
  RepositorioDeMensagensPrisma,
  RepositorioDeUsoDeIAPrisma,
} from './infra/repositorios.prisma';
import { TransporteDeWhatsappFake } from './infra/whatsapp.fake';
import {
  ArquivosController,
  ConexoesMetaController,
  IntegracoesDeDevController,
} from './interface/http/integracoes.controller';

/**
 * Integrações de plataforma (T13d): conexões da Meta, Mensageria (WhatsApp e e-mail), GeradorIA e
 * Armazenamento. Global e sem dependência dos domínios de negócio: alunos, cobrança e funcionários
 * registram seus dados (contatos e variáveis de mensagem) em `DiretorioDeAlunos` e
 * `RegistroDeVariaveis`, e qualquer módulo injeta `Mensageria`, `GeradorIA` ou `Armazenamento`.
 */
@Global()
@Module({
  controllers: [ConexoesMetaController, ArquivosController, IntegracoesDeDevController],
  providers: [
    {
      provide: CONFIGURACAO_DAS_INTEGRACOES,
      useFactory: (env?: Env) => configuracaoDasIntegracoes(env),
      inject: [{ token: ENV, optional: true }],
    },
    // Só adapters fake até haver contas reais (Meta, WhatsApp, IA): os flags do ambiente só aceitam `fake`.
    { provide: ProvedorMeta, useClass: ProvedorMetaFake },
    TransporteDeWhatsappFake,
    { provide: TransporteDeWhatsapp, useExisting: TransporteDeWhatsappFake },
    ProvedorDeIAFake,
    { provide: ProvedorDeIA, useExisting: ProvedorDeIAFake },
    ObjetosDeArmazenamentoFake,
    {
      provide: ObjetosDeArmazenamento,
      useFactory: (
        config: ConfiguracaoDasIntegracoes,
        fake: ObjetosDeArmazenamentoFake,
        relogio: Relogio,
      ): ObjetosDeArmazenamento =>
        config.armazenamento === 's3'
          ? new ObjetosDeArmazenamentoS3(config.s3, () => relogio.agora())
          : fake,
      inject: [CONFIGURACAO_DAS_INTEGRACOES, ObjetosDeArmazenamentoFake, Relogio],
    },
    { provide: TenantDoContexto, useClass: TenantDoContextoAtual },
    { provide: AssinadorDoFluxo, useClass: AssinadorDoFluxoHmac },
    { provide: RepositorioDeConexoes, useClass: RepositorioDeConexoesPrisma },
    { provide: RepositorioDeMensagens, useClass: RepositorioDeMensagensPrisma },
    { provide: RepositorioDeUsoDeIA, useClass: RepositorioDeUsoDeIAPrisma },
    RegistroDeAtividade,
    RegistroDeVariaveis,
    ResolvedorDeVariaveis,
    DiretorioDeAlunos,
    ConexoesMeta,
    Mensageria,
    GeradorIA,
    Armazenamento,
    WebhookDoWhatsapp,
    DadosDoTitularDasIntegracoes,
    RenovacaoDosTokensDaMeta,
  ],
  exports: [
    ConexoesMeta,
    Mensageria,
    GeradorIA,
    Armazenamento,
    DiretorioDeAlunos,
    RegistroDeVariaveis,
    ResolvedorDeVariaveis,
    RepositorioDeMensagens,
    RepositorioDeUsoDeIA,
  ],
})
export class IntegracoesModule implements OnModuleInit {
  constructor(
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDasIntegracoes,
    private readonly webhook: WebhookDoWhatsapp,
    @Inject(PROVEDORES_DE_WEBHOOK) private readonly provedores: ProvedorDeWebhook[],
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
    if (!this.provedores.some((provedor) => provedor.nome === this.webhook.nome)) {
      this.provedores.push(this.webhook);
    }
  }
}
