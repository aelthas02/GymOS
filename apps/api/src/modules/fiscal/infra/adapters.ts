import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { Filas } from '../../platform/application/eventos';
import { ProvedorDeWebhook, type ResultadoDoWebhook } from '../../platform/application/portas';
import { Relogio } from '../../platform/domain/relogio';
import { ContextoDoTenant } from '../../platform/infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../../platform/infra/contexto/executor-de-tenant';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../../platform/infra/filas/configuracao-das-filas';
import { NotasFiscais } from '../application/notas-fiscais';
import { EmissorFiscal, FilaDasNotas, RepositorioDeNotas } from '../application/portas';

/** Jobs da fila `notas`. */
export const JOB_DE_EMISSAO = 'fiscal.emitir-nota';
export const JOB_DE_CONFERENCIA = 'fiscal.conferir-nota';

/** O job nunca corre antes do commit que o pediu. */
const ESPERA_MINIMA_MS = 1_000;
const ESPERA_DA_CONFERENCIA_MS = 30_000;
const ESPERA_MAXIMA_DA_CONFERENCIA_MS = 10 * 60_000;

@Injectable()
export class FilaDasNotasBullMQ extends FilaDasNotas {
  constructor(
    private readonly filas: Filas,
    private readonly contexto: ContextoDoTenant,
    private readonly relogio: Relogio,
  ) {
    super();
  }

  tenantId(): string {
    return this.contexto.tenant().id;
  }

  async emitir(notaId: string): Promise<void> {
    await this.filas.enfileirar(
      'notas',
      JOB_DE_EMISSAO,
      { tenantId: this.tenantId(), notaId },
      { id: `emitir:${notaId}:${this.relogio.agora().getTime()}`, atrasoMs: ESPERA_MINIMA_MS },
    );
  }

  async conferirDepois(notaId: string, tentativa: number): Promise<void> {
    const atrasoMs = Math.min(
      ESPERA_DA_CONFERENCIA_MS * Math.max(1, tentativa),
      ESPERA_MAXIMA_DA_CONFERENCIA_MS,
    );
    await this.filas.enfileirar(
      'notas',
      JOB_DE_CONFERENCIA,
      { tenantId: this.tenantId(), notaId },
      { id: `conferir:${notaId}:${this.relogio.agora().getTime()}`, atrasoMs },
    );
  }
}

/** Webhook do emissor fiscal em `/webhooks/<provedor>/<tenantSlug>` (resultado assíncrono). */
@Injectable()
export class WebhookDoEmissorFiscal extends ProvedorDeWebhook {
  constructor(
    private readonly emissor: EmissorFiscal,
    private readonly notas: NotasFiscais,
  ) {
    super();
  }

  get nome(): string {
    return this.emissor.provedor;
  }

  idExterno(): string | null {
    // A rota traz o tenant; a chave da nota é o nosso id, sem referência externa.
    return null;
  }

  override assinaturaValida(
    corpo: unknown,
    cabecalhos: Record<string, string | undefined>,
  ): boolean {
    return this.emissor.assinaturaValida(corpo, cabecalhos);
  }

  async processar(corpo: unknown): Promise<ResultadoDoWebhook> {
    const evento = this.emissor.interpretar(corpo);
    return evento ? this.notas.aoReceberDoEmissor(evento) : 'recurso-nao-encontrado';
  }
}

/**
 * LGPD (T13c): notas fiscais têm guarda de 5 anos, então a exclusão do titular anonimiza o tomador
 * (sem aluno, sem CPF, nome "Titular removido"); a nota, o PDF e o XML ficam.
 */
@Injectable()
export class DadosDoTitularDoFiscal implements ProvedorDeDadosDoTitular {
  readonly dominio = 'fiscal';
  readonly retencao = { motivo: 'Guarda de notas fiscais', prazoEmAnos: 5 };

  constructor(private readonly notas: RepositorioDeNotas) {}

  async exportar(alunoId: string): Promise<unknown> {
    return (await this.notas.doAluno(alunoId)).map((nota) => ({
      tipo: nota.tipo,
      numero: nota.numero,
      situacao: nota.situacao,
      descricao: nota.descricao,
      competencia: nota.competencia,
      valorCentavos: nota.valorCentavos,
      emitidaEm: nota.emitidaEm,
    }));
  }

  /** Com retenção, o modo é sempre `anonimizar`. */
  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    return { registros: await this.notas.anonimizarDoAluno(alunoId) };
  }
}

const INTERVALO_DO_LOTE_MS = 5 * 60_000;

/**
 * Regra "em lote no fim do mês": a cada 5 minutos, por academia, agenda as NFS-e pendentes que já
 * chegaram às 22:00 (São Paulo) do último dia do mês. Também roda ao subir. Só com `FILAS_PROCESSAR`.
 */
@Injectable()
export class RotinaDoLoteFiscal implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RotinaDoLoteFiscal.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly notas: NotasFiscais,
    private readonly relogio: Relogio,
    @Optional()
    @Inject(CONFIGURACAO_DAS_FILAS)
    private readonly filas?: ConfiguracaoDasFilas,
  ) {}

  async executar(agora: Date = this.relogio.agora()): Promise<number> {
    const agendadas = await this.executor.paraCadaTenant(() => this.notas.emitirLote(agora));
    return agendadas.reduce((total, quantas) => total + quantas, 0);
  }

  onApplicationBootstrap(): void {
    if (!this.filas?.processar) {
      return;
    }
    const rodar = (): void => {
      this.executar().then(
        (total) => total > 0 && this.logger.log({ total }, 'Lote de notas fiscais agendado'),
        (err: unknown) => this.logger.error({ err }, 'Falha na rotina do lote de notas fiscais'),
      );
    };
    rodar();
    this.temporizador = setInterval(rodar, INTERVALO_DO_LOTE_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }
}
