import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { ProvedorDeWebhook, type ResultadoDoWebhook } from '../../platform/application/portas';
import { FUSO_PADRAO } from '../../platform/domain/relogio';
import { ExecutorDeTenant } from '../../platform/infra/contexto/executor-de-tenant';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../../platform/infra/filas/configuracao-das-filas';
import { Pagamentos } from '../application/pagamentos';
import { Parcelas } from '../application/parcelas';
import {
  GatewayDePagamento,
  Mensageria,
  type MensagemTransacional,
  RepositorioDeCobrancas,
  RepositorioDeFormasDePagamento,
  RepositorioDePagamentos,
  RepositorioDeParcelas,
} from '../application/portas';

/** Webhook do provedor de pagamento, na rota `/webhooks/<provedor>` da plataforma. */
@Injectable()
export class WebhookDePagamentos extends ProvedorDeWebhook {
  constructor(
    private readonly gateway: GatewayDePagamento,
    private readonly pagamentos: Pagamentos,
  ) {
    super();
  }

  get nome(): string {
    return this.gateway.provedor;
  }

  idExterno(corpo: unknown): string | null {
    return this.gateway.interpretar(corpo)?.idCobranca ?? null;
  }

  override assinaturaValida(
    corpo: unknown,
    cabecalhos: Record<string, string | undefined>,
  ): boolean {
    return this.gateway.assinaturaValida(corpo, cabecalhos);
  }

  async processar(corpo: unknown): Promise<ResultadoDoWebhook> {
    const evento = this.gateway.interpretar(corpo);
    return evento ? this.pagamentos.aoReceberDoProvedor(evento) : 'recurso-nao-encontrado';
  }
}

/**
 * Até a Mensageria (T13d) existir, a mensagem de cobrança só vai para o log (sem dados pessoais): o
 * T13d troca este adapter pelo envio real (WhatsApp ou e-mail).
 */
@Injectable()
export class MensageriaPendente extends Mensageria {
  private readonly logger = new Logger(MensageriaPendente.name);

  async enviar(mensagem: MensagemTransacional): Promise<void> {
    this.logger.log(
      { alunoId: mensagem.alunoId, contexto: mensagem.contexto },
      'Mensagem de cobrança aguardando a Mensageria (T13d)',
    );
  }
}

/**
 * LGPD (T13c): pagamentos têm retenção fiscal, então a exclusão anonimiza (tira o aluno das parcelas,
 * cobranças e pagamentos e cancela o que estava a receber) e apaga a forma de pagamento.
 */
@Injectable()
export class DadosDoTitularDaCobranca implements ProvedorDeDadosDoTitular {
  readonly dominio = 'cobranca';
  readonly retencao = { motivo: 'Registros de pagamento (obrigação fiscal)', prazoEmAnos: 5 };

  constructor(
    private readonly parcelas: RepositorioDeParcelas,
    private readonly cobrancas: RepositorioDeCobrancas,
    private readonly pagamentos: RepositorioDePagamentos,
    private readonly formas: RepositorioDeFormasDePagamento,
  ) {}

  async exportar(alunoId: string): Promise<unknown> {
    const forma = await this.formas.doAluno(alunoId);
    return {
      parcelas: await this.parcelas.doAluno(alunoId),
      cobrancas: await this.cobrancas.doAluno(alunoId),
      pagamentos: await this.pagamentos.doAluno(alunoId),
      formaDePagamento: forma && { forma: forma.forma, finalDoCartao: forma.finalDoCartao },
    };
  }

  /** Com retenção, o modo é sempre `anonimizar`. */
  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    const registros = await Promise.all([
      this.parcelas.anonimizarDoAluno(alunoId),
      this.cobrancas.anonimizarDoAluno(alunoId),
      this.pagamentos.anonimizarDoAluno(alunoId),
      this.formas.excluirDoAluno(alunoId),
    ]);
    return { registros: registros.reduce((total, quantos) => total + quantos, 0) };
  }
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** Milissegundos até a próxima 00:05 no fuso (São Paulo não tem horário de verão desde 2019). */
export function ateAsZeroHoraECinco(agora: Date, fuso: string = FUSO_PADRAO): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(agora);
  const valor = (tipo: string): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value ?? 0);
  const desdeMeiaNoite =
    ((valor('hour') * 60 + valor('minute')) * 60 + valor('second')) * 1000 +
    agora.getMilliseconds();
  const alvo = 5 * 60 * 1000;
  return (alvo - desdeMeiaNoite + UM_DIA_MS) % UM_DIA_MS || UM_DIA_MS;
}

/**
 * Rotina diária dos atrasos (00:05 de São Paulo), um runAsTenant por academia: parcela vencida vira
 * atrasada e publica PagamentoAtrasado. Também roda ao subir; é idempotente. Só com `FILAS_PROCESSAR`.
 */
@Injectable()
export class RotinaDosAtrasos implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RotinaDosAtrasos.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly parcelas: Parcelas,
    @Optional()
    @Inject(CONFIGURACAO_DAS_FILAS)
    private readonly filas?: ConfiguracaoDasFilas,
  ) {}

  async executar(): Promise<number> {
    const marcadas = await this.executor.paraCadaTenant(() => this.parcelas.marcarAtrasos());
    return marcadas.reduce((total, quantas) => total + quantas, 0);
  }

  onApplicationBootstrap(): void {
    if (!this.filas?.processar) {
      return;
    }
    const rodar = (): void => {
      this.executar().then(
        (total) => this.logger.log({ total }, 'Rotina diária dos atrasos executada'),
        (err: unknown) => this.logger.error({ err }, 'Falha na rotina diária dos atrasos'),
      );
    };
    const agendar = (): void => {
      this.temporizador = setTimeout(() => {
        rodar();
        agendar();
      }, ateAsZeroHoraECinco(new Date()));
      this.temporizador.unref();
    };
    rodar();
    agendar();
  }

  onModuleDestroy(): void {
    clearTimeout(this.temporizador);
  }
}
