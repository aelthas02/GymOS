import { Global, Module, type OnModuleInit } from '@nestjs/common';
import type { Env } from '../../config/env';
import { ENV } from '../../config/env.module';
import { AlunosModule } from '../alunos/alunos.module';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { RegistroDeConsumidores } from '../platform/infra/eventos/registro-de-consumidores';
import { ProcessadorDeFilas } from '../platform/infra/filas/processador-de-filas';
import { AutoriaDosAvisos } from './application/autoria';
import { CaixaDeAvisos, InscricoesDePush, PreferenciasDeAviso } from './application/caixa';
import { Comunicados } from './application/comunicados';
import { EnvioDePush } from './application/envio-de-push';
import { Notificador } from './application/notificador';
import {
  AgendadorDeAvisos,
  DestinatariosDeComunicado,
  RepositorioDeAgendamentos,
  RepositorioDeAvisos,
  RepositorioDeInscricoes,
  RepositorioDePreferencias,
  WebPush,
} from './application/portas';
import {
  AgendadorDeAvisosNaFila,
  DadosDoTitularDosAvisos,
  JOB_DE_AVISO_AGENDADO,
  TodosOsAlunosDaAcademia,
} from './infra/adapters';
import {
  RepositorioDeAgendamentosPrisma,
  RepositorioDeAvisosPrisma,
  RepositorioDeInscricoesPrisma,
  RepositorioDePreferenciasPrisma,
} from './infra/repositorios.prisma';
import { WebPushFake } from './infra/push/web-push.fake';
import {
  CONFIGURACAO_DO_PUSH,
  type ConfiguracaoDoPush,
  WebPushVapid,
} from './infra/push/web-push.vapid';
import {
  AvisosDoAppController,
  ComunicadosController,
  PushDoAppController,
} from './interface/http/avisos.controller';

/**
 * Notificações e avisos (T13e): a caixa de avisos do aluno, o Web Push e os agendamentos. Global:
 * qualquer domínio injeta o `Notificador`, sem importar este módulo.
 */
@Global()
@Module({
  imports: [AlunosModule],
  controllers: [AvisosDoAppController, PushDoAppController, ComunicadosController],
  providers: [
    { provide: RepositorioDeAvisos, useClass: RepositorioDeAvisosPrisma },
    { provide: RepositorioDeInscricoes, useClass: RepositorioDeInscricoesPrisma },
    { provide: RepositorioDePreferencias, useClass: RepositorioDePreferenciasPrisma },
    { provide: RepositorioDeAgendamentos, useClass: RepositorioDeAgendamentosPrisma },
    { provide: AgendadorDeAvisos, useClass: AgendadorDeAvisosNaFila },
    { provide: DestinatariosDeComunicado, useClass: TodosOsAlunosDaAcademia },
    {
      provide: CONFIGURACAO_DO_PUSH,
      useFactory: (env?: Env): ConfiguracaoDoPush => ({
        // Sem o ENV (módulo montado em teste), vale o fake.
        transporte: env?.PUSH_TRANSPORTE ?? 'fake',
        chavePublica: env?.VAPID_PUBLIC_KEY ?? '',
        chavePrivada: env?.VAPID_PRIVATE_KEY ?? '',
        contato: env?.VAPID_SUBJECT ?? 'mailto:suporte@gymos.app',
      }),
      inject: [{ token: ENV, optional: true }],
    },
    {
      provide: WebPush,
      useFactory: (config: ConfiguracaoDoPush): WebPush =>
        config.transporte === 'vapid' ? new WebPushVapid(config) : new WebPushFake(),
      inject: [CONFIGURACAO_DO_PUSH],
    },
    AutoriaDosAvisos,
    DadosDoTitularDosAvisos,
    Notificador,
    CaixaDeAvisos,
    InscricoesDePush,
    PreferenciasDeAviso,
    EnvioDePush,
    Comunicados,
  ],
  exports: [Notificador],
})
export class AvisosModule implements OnModuleInit {
  constructor(
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDosAvisos,
    private readonly consumidores: RegistroDeConsumidores,
    private readonly processador: ProcessadorDeFilas,
    private readonly notificador: Notificador,
    private readonly envioDePush: EnvioDePush,
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
    this.consumidores.registrar({
      nome: 'avisos.enviar-push',
      evento: 'PushSolicitado',
      fila: 'notificacoes',
      tratar: (evento) => this.envioDePush.enviar(evento.payload.avisoIds),
    });
    this.processador.registrarTrabalho<{ tenantId: string; agendamentoId: string }>(
      'notificacoes',
      JOB_DE_AVISO_AGENDADO,
      async (dados) => {
        await this.notificador.enviarAgendado(dados.agendamentoId);
      },
    );
  }
}
