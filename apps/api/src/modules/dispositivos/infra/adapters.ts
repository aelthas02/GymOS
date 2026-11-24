import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { ExecutorDeTenant } from '../../platform/infra/contexto/executor-de-tenant';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../../platform/infra/filas/configuracao-das-filas';
import { CadastrosBiometricos } from '../application/biometria';
import { CacheDeAutorizacao } from '../application/cache-de-acesso';
import { Dispositivos } from '../application/dispositivos';

/**
 * LGPD (T23b): o cadastro biométrico do aluno (só a referência e o status; o template fica no
 * equipamento). A exclusão manda o agente apagar o cadastro do equipamento e apaga a referência; o
 * aluno ganha versão nova no cache, e o agente o remove da lista de autorizados.
 */
@Injectable()
export class DadosDoTitularDosDispositivos implements ProvedorDeDadosDoTitular {
  readonly dominio = 'dispositivos';

  constructor(
    private readonly biometrias: CadastrosBiometricos,
    private readonly cache: CacheDeAutorizacao,
  ) {}

  async exportar(alunoId: string): Promise<unknown> {
    const cadastros = await this.biometrias.doAluno(alunoId);
    return {
      cadastrosBiometricos: cadastros.map((cadastro) => ({
        tipo: cadastro.tipo,
        status: cadastro.status,
        referencia: cadastro.referencia,
        atualizadoEm: cadastro.atualizadoEm,
      })),
    };
  }

  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    const registros = await this.biometrias.removerDoAluno(alunoId);
    await this.cache.alunoMudou(alunoId);
    return { registros };
  }
}

/** Intervalo da rotina que derruba os dispositivos sem sinal: bem menor que os 90 s de tolerância. */
const INTERVALO_DA_ROTINA_MS = 30 * 1000;

/**
 * Job das quedas de dispositivo: a cada 30 s, tenant por tenant, derruba o que está sem batimento
 * há mais de 90 s (abre a queda e avisa o tempo real) e expira os comandos sem resposta. Só com
 * `FILAS_PROCESSAR`.
 */
@Injectable()
export class RotinaDasQuedas implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RotinaDasQuedas.name);
  private temporizador?: NodeJS.Timeout;
  private rodando = false;

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly dispositivos: Dispositivos,
    @Optional()
    @Inject(CONFIGURACAO_DAS_FILAS)
    private readonly filas?: ConfiguracaoDasFilas,
  ) {}

  /** Quantos dispositivos caíram agora, somando os tenants. */
  async executar(): Promise<number> {
    const caidos = await this.executor.paraCadaTenant(() => this.dispositivos.verificarQuedas());
    return caidos.reduce((soma, quantos) => soma + quantos, 0);
  }

  onApplicationBootstrap(): void {
    if (!this.filas?.processar) {
      return;
    }
    this.temporizador = setInterval(() => {
      if (this.rodando) {
        return;
      }
      this.rodando = true;
      this.executar()
        .then(
          (caidos) => {
            if (caidos > 0) {
              this.logger.warn({ caidos }, 'Dispositivos sem batimento passaram a offline');
            }
          },
          (err: unknown) => this.logger.error({ err }, 'Falha na verificação dos dispositivos'),
        )
        .finally(() => {
          this.rodando = false;
        });
    }, INTERVALO_DA_ROTINA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }
}
