import { Module, type OnModuleInit } from '@nestjs/common';
import type { TipoDeEvento } from '@gymos/shared-events';
import { AcessoModule } from '../acesso/acesso.module';
import { RegistroDeProvedoresDoTitular } from '../platform/application/direitos-do-titular';
import { RegistroDeConsumidores } from '../platform/infra/eventos/registro-de-consumidores';
import { AoVivo } from './application/ao-vivo';
import { CadastrosBiometricos } from './application/biometria';
import { CacheDeAutorizacao } from './application/cache-de-acesso';
import { ComandosDoAgente } from './application/comandos';
import { Dispositivos } from './application/dispositivos';
import { Pareamento } from './application/pareamento';
import {
  RepositorioDeAgentes,
  RepositorioDeCadastrosBiometricos,
  RepositorioDeCodigos,
  RepositorioDeComandos,
  RepositorioDeDispositivos,
  RepositorioDeQuedas,
  RepositorioDoCacheDeAcesso,
} from './application/portas';
import { DadosDoTitularDosDispositivos, RotinaDasQuedas } from './infra/adapters';
import {
  RepositorioDeAgentesPrisma,
  RepositorioDeCadastrosBiometricosPrisma,
  RepositorioDeCodigosPrisma,
  RepositorioDeComandosPrisma,
  RepositorioDeDispositivosPrisma,
  RepositorioDeQuedasPrisma,
  RepositorioDoCacheDeAcessoPrisma,
} from './infra/repositorios.prisma';
import { AgenteController, PareamentoDoAgenteController } from './interface/http/agente.controller';
import { AgenteGuard } from './interface/http/agente.guard';
import {
  AgentesDaCatracaController,
  AoVivoController,
  CadastrosBiometricosController,
  DispositivosController,
} from './interface/http/dispositivos.controller';

/** Eventos que mudam a decisão offline sobre um aluno: o cache do agente ganha versão nova. */
const EVENTOS_DO_ALUNO = [
  'AlunoCadastrado',
  'ContratoCriado',
  'ContratoRenovado',
  'ContratoEncerrado',
  'ContratoReativado',
  'ContratoTrancado',
  'ContratoDestrancado',
  'PagamentoConfirmado',
  'PagamentoAtrasado',
  'PagamentoEstornado',
  'VencimentoCombinado',
] as const satisfies readonly TipoDeEvento[];

/**
 * Dispositivos, pareamento do agente e tempo real do acesso (T23b, ADR-010 e ADR-016): catracas e
 * leitores com status pelo batimento, código de pareamento e credencial do agente, API do agente
 * (cache de autorização com versão, lote de acessos, batimento, comandos), cadastro biométrico e o
 * SSE por tenant sobre o pub/sub do T13a.
 */
@Module({
  imports: [AcessoModule],
  controllers: [
    DispositivosController,
    AgentesDaCatracaController,
    CadastrosBiometricosController,
    AoVivoController,
    PareamentoDoAgenteController,
    AgenteController,
  ],
  providers: [
    { provide: RepositorioDeAgentes, useClass: RepositorioDeAgentesPrisma },
    { provide: RepositorioDeCodigos, useClass: RepositorioDeCodigosPrisma },
    { provide: RepositorioDeDispositivos, useClass: RepositorioDeDispositivosPrisma },
    { provide: RepositorioDeQuedas, useClass: RepositorioDeQuedasPrisma },
    { provide: RepositorioDeComandos, useClass: RepositorioDeComandosPrisma },
    {
      provide: RepositorioDeCadastrosBiometricos,
      useClass: RepositorioDeCadastrosBiometricosPrisma,
    },
    { provide: RepositorioDoCacheDeAcesso, useClass: RepositorioDoCacheDeAcessoPrisma },
    Pareamento,
    Dispositivos,
    ComandosDoAgente,
    CacheDeAutorizacao,
    CadastrosBiometricos,
    AoVivo,
    AgenteGuard,
    DadosDoTitularDosDispositivos,
    RotinaDasQuedas,
  ],
  exports: [Dispositivos, CacheDeAutorizacao, AoVivo],
})
export class DispositivosModule implements OnModuleInit {
  constructor(
    private readonly titular: RegistroDeProvedoresDoTitular,
    private readonly dadosDoTitular: DadosDoTitularDosDispositivos,
    private readonly consumidores: RegistroDeConsumidores,
    private readonly cache: CacheDeAutorizacao,
    private readonly aoVivo: AoVivo,
  ) {}

  onModuleInit(): void {
    this.titular.registrar(this.dadosDoTitular);
    for (const evento of EVENTOS_DO_ALUNO) {
      this.consumidores.registrar({
        nome: `dispositivos.cache-${evento.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
        evento,
        tratar: (e) => this.cache.alunoMudou((e.payload as { alunoId: string }).alunoId),
      });
    }
    this.consumidores.registrar({
      nome: 'dispositivos.cache-regras-de-acesso-alteradas',
      evento: 'RegrasDeAcessoAlteradas',
      tratar: () => this.cache.regrasMudaram(),
    });
    // Tempo real: sai do consumidor, depois do commit, e chega a quem assina em qualquer réplica.
    this.consumidores.registrar({
      nome: 'dispositivos.ao-vivo-acesso',
      evento: 'AcessoRegistrado',
      tratar: (e) => this.aoVivo.acessoRegistrado(e),
    });
    this.consumidores.registrar({
      nome: 'dispositivos.ao-vivo-dispositivo',
      evento: 'DispositivoMudouDeEstado',
      tratar: (e) => this.aoVivo.dispositivoMudouDeEstado(e),
    });
  }
}
