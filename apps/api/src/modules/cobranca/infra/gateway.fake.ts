import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { aplicarAliquota, centavos, pontosBase } from '@gymos/shared-money';
import {
  type CobrancaNoProvedor,
  type DadosDaCobranca,
  type EventoDoProvedor,
  GatewayDePagamento,
  type PedidoDeCobranca,
  type SituacaoDaCobranca,
} from '../application/portas';
import { FORMAS_DE_COBRANCA, type FormaDeCobranca } from '../domain/pagamento';
import { CONFIGURACAO_DOS_PAGAMENTOS, type ConfiguracaoDosPagamentos } from './configuracao';

export const CABECALHO_DA_ASSINATURA = 'x-assinatura';

/** Taxas simuladas: PIX 0,99%, cartão 3,49%, link 3,99% e boleto R$ 3,49 fixos. */
function taxaFake(forma: FormaDeCobranca, valorCentavos: number): number {
  if (forma === 'boleto') {
    return 349;
  }
  const aliquota = { pix: 99, cartao: 349, link: 399 }[forma];
  return aplicarAliquota(centavos(valorCentavos), pontosBase(aliquota));
}

function texto(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== '';
}

/**
 * Provedor de pagamento fake (ADR-009): determinístico, sem rede. O link de cada cobrança abre a
 * página de pagamento simulada (`/api/pagamento-simulado/:idExterno`), que gera o webhook assinado.
 * Corpo do webhook: `{ tipo, idEvento, idCobranca, valorCentavos, taxaCentavos?, forma?, ocorridoEm }`.
 */
@Injectable()
export class GatewayDePagamentoFake extends GatewayDePagamento {
  readonly provedor = 'pagamentos-fake';

  constructor(
    @Inject(CONFIGURACAO_DOS_PAGAMENTOS) private readonly config: ConfiguracaoDosPagamentos,
  ) {
    super();
  }

  async criarCobranca(pedido: PedidoDeCobranca): Promise<CobrancaNoProvedor> {
    const idExterno = `fake_${pedido.referencia}`;
    const url = `${this.config.urlPublica}/api/pagamento-simulado/${idExterno}`;
    const dados: DadosDaCobranca = { url };
    if (pedido.forma === 'pix') {
      dados.pixCopiaECola = `00020126580014BR.GOV.BCB.PIX0136${pedido.referencia}5204000053039865406${(pedido.valorCentavos / 100).toFixed(2)}5802BR6009SAO PAULO6304FAKE`;
      dados.pixQrCode = dados.pixCopiaECola;
    }
    if (pedido.forma === 'boleto') {
      const digitos = pedido.referencia.replace(/\D/g, '').padEnd(36, '0').slice(0, 36);
      dados.linhaDigitavel = `23790${digitos}${String(pedido.valorCentavos).padStart(6, '0')}`;
    }
    return { idExterno, dados };
  }

  async consultar(): Promise<SituacaoDaCobranca> {
    return 'pendente';
  }

  async cancelar(): Promise<void> {
    // O fake não guarda estado: a cobrança cancelada só deixa de valer do nosso lado.
  }

  async estornar(): Promise<{ idEstorno: string }> {
    return { idEstorno: `fake_est_${randomUUID()}` };
  }

  assinar(corpo: unknown): string {
    return createHmac('sha256', this.config.segredoDoWebhook)
      .update(JSON.stringify(corpo))
      .digest('hex');
  }

  assinaturaValida(corpo: unknown, cabecalhos: Record<string, string | undefined>): boolean {
    const recebida = Buffer.from(cabecalhos[CABECALHO_DA_ASSINATURA] ?? '', 'utf-8');
    const esperada = Buffer.from(this.assinar(corpo), 'utf-8');
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  }

  interpretar(corpo: unknown): EventoDoProvedor | null {
    if (typeof corpo !== 'object' || corpo === null) {
      return null;
    }
    const { tipo, idEvento, idCobranca, valorCentavos, taxaCentavos, forma, ocorridoEm } =
      corpo as Record<string, unknown>;
    const instante = texto(ocorridoEm) ? new Date(ocorridoEm) : null;
    if (
      !texto(idEvento) ||
      !texto(idCobranca) ||
      !Number.isSafeInteger(valorCentavos) ||
      (valorCentavos as number) < 1 ||
      !instante ||
      Number.isNaN(instante.getTime())
    ) {
      return null;
    }
    const valor = valorCentavos as number;
    if (tipo === 'pagamento_estornado') {
      return { tipo, idEvento, idCobranca, valorCentavos: valor, ocorridoEm: instante };
    }
    if (tipo !== 'pagamento_confirmado') {
      return null;
    }
    const formaValida = (FORMAS_DE_COBRANCA as readonly unknown[]).includes(forma)
      ? (forma as FormaDeCobranca)
      : 'link';
    return {
      tipo,
      idEvento,
      idCobranca,
      valorCentavos: valor,
      taxaCentavos: Number.isSafeInteger(taxaCentavos)
        ? (taxaCentavos as number)
        : taxaFake(formaValida, valor),
      forma: formaValida,
      ocorridoEm: instante,
    };
  }

  /** Corpo do webhook de confirmação que a página simulada envia. */
  eventoDePagamento(
    cobranca: { idExterno: string; valorCentavos: number; forma: FormaDeCobranca },
    ocorridoEm: Date,
  ): Record<string, unknown> {
    return {
      tipo: 'pagamento_confirmado',
      idEvento: `fake_evt_${randomUUID()}`,
      idCobranca: cobranca.idExterno,
      valorCentavos: cobranca.valorCentavos,
      taxaCentavos: taxaFake(cobranca.forma, cobranca.valorCentavos),
      forma: cobranca.forma,
      ocorridoEm: ocorridoEm.toISOString(),
    };
  }
}
