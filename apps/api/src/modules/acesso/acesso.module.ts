import { Module, type OnModuleInit } from '@nestjs/common';
import { AlunosModule } from '../alunos/alunos.module';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { Acessos } from './application/acessos';
import { AlertasDeFrequencia } from './application/alertas';
import { AutoriaDoAcesso } from './application/autoria';
import { ConfiguracoesDoAcesso, ConfiguracoesDosAlertas } from './application/configuracoes';
import { Frequencia } from './application/frequencia';
import {
  AcademiaAtual,
  AlunosParaAcesso,
  RegistroDeQrUsado,
  RepositorioDeAcessos,
  RepositorioDeAlertas,
  RepositorioDeChavesDeQr,
  RepositorioDeConfiguracaoDeAcesso,
  RepositorioDeConfiguracaoDeAlertas,
} from './application/portas';
import { QrDeCheckin } from './application/qr';
import {
  AcademiaDoContexto,
  AlunosParaAcessoDosAlunos,
  DadosDoTitularDoAcesso,
  RotinaDosAlertas,
} from './infra/adapters';
import {
  RegistroDeQrUsadoPrisma,
  RepositorioDeAcessosPrisma,
  RepositorioDeAlertasPrisma,
  RepositorioDeChavesDeQrPrisma,
  RepositorioDeConfiguracaoDeAcessoPrisma,
  RepositorioDeConfiguracaoDeAlertasPrisma,
} from './infra/repositorios.prisma';
import {
  AcessoController,
  AcessoDoAppController,
  ConfiguracoesDoAcessoController,
} from './interface/http/acesso.controller';

/**
 * Acesso e frequência (T23a, ADR-018): check-in e check-out, regras de acesso (o pacote
 * `@gymos/shared-acesso`, o mesmo do agente da catraca), QR de check-in do app, liberação manual da
 * Recepção, sincronização dos acessos offline e alertas de frequência. Exporta `Frequencia` (check-ins
 * de hoje e frequência por horário para o Início, presenças do mês para o rateio do T21) e `Acessos`.
 * Dispositivos, pareamento e tempo real são do T23b (`DispositivosModule`).
 */
@Module({
  imports: [AlunosModule],
  controllers: [AcessoController, AcessoDoAppController, ConfiguracoesDoAcessoController],
  providers: [
    { provide: RepositorioDeAcessos, useClass: RepositorioDeAcessosPrisma },
    {
      provide: RepositorioDeConfiguracaoDeAcesso,
      useClass: RepositorioDeConfiguracaoDeAcessoPrisma,
    },
    {
      provide: RepositorioDeConfiguracaoDeAlertas,
      useClass: RepositorioDeConfiguracaoDeAlertasPrisma,
    },
    { provide: RepositorioDeChavesDeQr, useClass: RepositorioDeChavesDeQrPrisma },
    { provide: RegistroDeQrUsado, useClass: RegistroDeQrUsadoPrisma },
    { provide: RepositorioDeAlertas, useClass: RepositorioDeAlertasPrisma },
    { provide: AlunosParaAcesso, useClass: AlunosParaAcessoDosAlunos },
    { provide: AcademiaAtual, useClass: AcademiaDoContexto },
    AutoriaDoAcesso,
    QrDeCheckin,
    Acessos,
    Frequencia,
    AlertasDeFrequencia,
    ConfiguracoesDoAcesso,
    ConfiguracoesDosAlertas,
    DadosDoTitularDoAcesso,
    RotinaDosAlertas,
  ],
  exports: [
    Acessos,
    Frequencia,
    AlertasDeFrequencia,
    ConfiguracoesDoAcesso,
    QrDeCheckin,
    AlunosParaAcesso,
    AutoriaDoAcesso,
  ],
})
export class AcessoModule implements OnModuleInit {
  constructor(
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDoAcesso,
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
  }
}
