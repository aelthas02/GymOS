import { Injectable } from '@nestjs/common';
import { sendNotification } from 'web-push';
import {
  type AlvoDePush,
  type MensagemDePush,
  type ResultadoDoPush,
  WebPush,
} from '../../application/portas';

export interface ConfiguracaoDoPush {
  /** `vapid` envia pelos provedores dos navegadores; `fake` só guarda em memória. */
  transporte: 'vapid' | 'fake';
  chavePublica: string;
  chavePrivada: string;
  /** `mailto:` ou URL do responsável pelo envio, exigido pelos provedores. */
  contato: string;
}

export const CONFIGURACAO_DO_PUSH = Symbol('ConfiguracaoDoPush');

/** Segundos que o provedor guarda a mensagem para um aparelho desligado (1 dia). */
const TTL_EM_SEGUNDOS = 24 * 3600;
const PRAZO_DO_ENVIO_MS = 10_000;

/** Web Push de verdade: VAPID com as chaves do ambiente, via biblioteca `web-push`. */
@Injectable()
export class WebPushVapid extends WebPush {
  constructor(private readonly config: ConfiguracaoDoPush) {
    super();
  }

  chavePublica(): string {
    return this.config.chavePublica;
  }

  async enviar(alvo: AlvoDePush, mensagem: MensagemDePush): Promise<ResultadoDoPush> {
    try {
      await sendNotification(
        { endpoint: alvo.endpoint, keys: { p256dh: alvo.p256dh, auth: alvo.auth } },
        JSON.stringify({ ...mensagem, tag: mensagem.avisoId }),
        {
          TTL: TTL_EM_SEGUNDOS,
          timeout: PRAZO_DO_ENVIO_MS,
          urgency: 'normal',
          vapidDetails: {
            subject: this.config.contato,
            publicKey: this.config.chavePublica,
            privateKey: this.config.chavePrivada,
          },
        },
      );
      return 'enviado';
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        return 'expirada';
      }
      throw erro;
    }
  }
}
