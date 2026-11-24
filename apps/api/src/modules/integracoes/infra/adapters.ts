import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ProvedorDeDadosDoTitular } from '../../platform/application/direitos-do-titular';
import { ProvedorDeWebhook, type ResultadoDoWebhook } from '../../platform/application/portas';
import { ExecutorDeTenant } from '../../platform/infra/contexto/executor-de-tenant';
import {
  CONFIGURACAO_DAS_FILAS,
  type ConfiguracaoDasFilas,
} from '../../platform/infra/filas/configuracao-das-filas';
import { ConexoesMeta } from '../application/conexoes-meta';
import { type EventoDoWhatsapp, Mensageria } from '../application/mensageria';
import { RepositorioDeMensagens } from '../application/portas';
import { CONFIGURACAO_DAS_INTEGRACOES, type ConfiguracaoDasIntegracoes } from './configuracao';

export const NOME_DO_WEBHOOK_DO_WHATSAPP = 'whatsapp';
export const CABECALHO_DA_ASSINATURA_DA_META = 'x-hub-signature-256';

const STATUS: Readonly<Record<string, 'entregue' | 'lida' | 'falha'>> = {
  delivered: 'entregue',
  read: 'lida',
  failed: 'falha',
};

const texto = (valor: unknown): valor is string => typeof valor === 'string' && valor !== '';

/**
 * Webhook do WhatsApp em `/webhooks/whatsapp/:tenantSlug` (o tenant vem sempre do caminho: não há
 * rota por id externo). Corpo: `{ tipo: 'status', idExterno, status: 'delivered' | 'read' | 'failed' }`
 * ou `{ tipo: 'resposta', de, texto, idExterno? }`. A assinatura é HMAC-SHA256 do JSON reserializado
 * (o provedor real vai exigir o corpo bruto, como no webhook de pagamentos).
 */
@Injectable()
export class WebhookDoWhatsapp extends ProvedorDeWebhook {
  readonly nome = NOME_DO_WEBHOOK_DO_WHATSAPP;

  constructor(
    private readonly mensageria: Mensageria,
    @Inject(CONFIGURACAO_DAS_INTEGRACOES) private readonly config: ConfiguracaoDasIntegracoes,
  ) {
    super();
  }

  idExterno(): string | null {
    return null;
  }

  assinar(corpo: unknown): string {
    return `sha256=${createHmac('sha256', this.config.segredoDoWebhook)
      .update(JSON.stringify(corpo))
      .digest('hex')}`;
  }

  override assinaturaValida(
    corpo: unknown,
    cabecalhos: Record<string, string | undefined>,
  ): boolean {
    const recebida = Buffer.from(cabecalhos[CABECALHO_DA_ASSINATURA_DA_META] ?? '');
    const esperada = Buffer.from(this.assinar(corpo));
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  }

  async processar(corpo: unknown): Promise<ResultadoDoWebhook> {
    return this.mensageria.aoReceber(this.interpretar(corpo));
  }

  private interpretar(corpo: unknown): EventoDoWhatsapp {
    const dados = (corpo ?? {}) as Record<string, unknown>;
    if (
      dados['tipo'] === 'status' &&
      texto(dados['idExterno']) &&
      STATUS[String(dados['status'])]
    ) {
      return {
        tipo: 'status',
        idExterno: dados['idExterno'],
        status: STATUS[String(dados['status'])] as 'entregue' | 'lida' | 'falha',
      };
    }
    if (dados['tipo'] === 'resposta' && texto(dados['de']) && texto(dados['texto'])) {
      return {
        tipo: 'resposta',
        telefone: dados['de'],
        texto: dados['texto'],
        idExterno: texto(dados['idExterno']) ? dados['idExterno'] : null,
      };
    }
    throw new BadRequestException('Evento do WhatsApp inválido.');
  }
}

/**
 * LGPD (T13d): as mensagens trazem o texto enviado ao aluno e as respostas dele. Sem retenção
 * legal: a exclusão apaga tudo.
 */
@Injectable()
export class DadosDoTitularDasIntegracoes implements ProvedorDeDadosDoTitular {
  readonly dominio = 'integracoes';

  constructor(private readonly mensagens: RepositorioDeMensagens) {}

  async exportar(alunoId: string): Promise<unknown> {
    const mensagens = await this.mensagens.doAluno(alunoId);
    return {
      mensagens: mensagens.map(({ direcao, canal, finalidade, texto, estado, criadoEm }) => ({
        direcao,
        canal,
        finalidade,
        texto,
        estado,
        criadoEm,
      })),
    };
  }

  async excluirOuAnonimizar(alunoId: string): Promise<{ registros: number }> {
    return { registros: await this.mensagens.excluirDoAluno(alunoId) };
  }
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Renovação dos tokens da Meta: um runAsTenant por academia, ao subir e a cada 24 h nos processos
 * com `FILAS_PROCESSAR=true`. Idempotente: renovar de novo um token já renovado não vence.
 */
@Injectable()
export class RenovacaoDosTokensDaMeta implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RenovacaoDosTokensDaMeta.name);
  private temporizador?: NodeJS.Timeout;

  constructor(
    private readonly executor: ExecutorDeTenant,
    private readonly conexoes: ConexoesMeta,
    @Optional()
    @Inject(CONFIGURACAO_DAS_FILAS)
    private readonly filas?: ConfiguracaoDasFilas,
  ) {}

  /** Renova o que vence nos próximos 7 dias em todos os tenants; devolve o total renovado. */
  async executar(): Promise<number> {
    const renovados = await this.executor.paraCadaTenant(() => this.conexoes.renovarAVencer());
    return renovados.reduce((total, quantos) => total + quantos, 0);
  }

  onApplicationBootstrap(): void {
    if (!this.filas?.processar) {
      return;
    }
    const rodar = (): void => {
      this.executar().then(
        (total) => this.logger.log({ total }, 'Renovação dos tokens da Meta executada'),
        (err: unknown) => this.logger.error({ err }, 'Falha na renovação dos tokens da Meta'),
      );
    };
    rodar();
    this.temporizador = setInterval(rodar, UM_DIA_MS);
    this.temporizador.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.temporizador);
  }
}
