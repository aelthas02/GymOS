import { Injectable } from '@nestjs/common';
import {
  type AlvoDePush,
  type MensagemDePush,
  type ResultadoDoPush,
  WebPush,
} from '../../application/portas';

/** Par VAPID só do dev (o mesmo do `.env.example`): o fake devolve a chave pública para o T32 testar. */
export const CHAVE_PUBLICA_DO_FAKE =
  'BOMhRdHvlAQwovoiwXOvqqBDNnAO_MMOXoVtxyWF2M-oFpXd-iQb5Xs9iKxIYU6NLMtuX7o9uhPtOvehwX33Q8g';

/**
 * Web Push determinístico (testes, dev sem provedor): guarda o que "enviou" em memória. Um endpoint
 * marcado com `expirar` responde como o 410 do provedor; um marcado com `falhar` lança erro.
 */
@Injectable()
export class WebPushFake extends WebPush {
  readonly enviados: Array<{ endpoint: string; mensagem: MensagemDePush }> = [];
  private readonly expirados = new Set<string>();
  private readonly falhos = new Set<string>();

  chavePublica(): string {
    return CHAVE_PUBLICA_DO_FAKE;
  }

  expirar(endpoint: string): void {
    this.expirados.add(endpoint);
  }

  falhar(endpoint: string): void {
    this.falhos.add(endpoint);
  }

  async enviar(alvo: AlvoDePush, mensagem: MensagemDePush): Promise<ResultadoDoPush> {
    if (this.expirados.has(alvo.endpoint)) {
      return 'expirada';
    }
    if (this.falhos.has(alvo.endpoint)) {
      throw new Error('Falha simulada do provedor de push.');
    }
    this.enviados.push({ endpoint: alvo.endpoint, mensagem });
    return 'enviado';
  }
}
