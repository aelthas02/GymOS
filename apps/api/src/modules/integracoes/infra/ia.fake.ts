import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  type PedidoAoProvedorDeIA,
  ProvedorDeIA,
  type ResultadoGerado,
} from '../application/portas';

/**
 * IA fake (T13d): resposta determinística, calculada do pedido, sem rede. Guarda os pedidos que
 * recebeu para os testes conferirem o que realmente sairia para um provedor.
 */
@Injectable()
export class ProvedorDeIAFake extends ProvedorDeIA {
  readonly nome = 'fake';
  readonly pedidos: PedidoAoProvedorDeIA[] = [];

  async gerar(pedido: PedidoAoProvedorDeIA): Promise<ResultadoGerado> {
    this.pedidos.push(pedido);
    const resultado: ResultadoGerado = {};
    for (const [campo, tipo] of Object.entries(pedido.formato)) {
      const digest = (parte: string): string =>
        createHash('sha256')
          .update(`${pedido.instrucao}|${JSON.stringify(pedido.dados)}|${campo}|${parte}`)
          .digest('hex')
          .slice(0, 8);
      resultado[campo] =
        tipo === 'lista'
          ? [1, 2, 3].map((n) => `${campo} ${n} (fake ${digest(String(n))})`)
          : `${campo} (fake ${digest('texto')})`;
    }
    return resultado;
  }
}
