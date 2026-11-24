import { Injectable, Logger } from '@nestjs/common';
import { TransporteDeWhatsapp } from '../application/portas';

export interface MensagemDoFake {
  tenantId: string;
  telefone: string;
  texto: string;
  idExterno: string;
}

/**
 * WhatsApp fake (T13d): guarda as mensagens em memória (o endpoint de dev as lista) e devolve ids
 * sequenciais. O adapter da Meta Cloud API entra atrás de flag quando houver conta real.
 */
@Injectable()
export class TransporteDeWhatsappFake extends TransporteDeWhatsapp {
  private readonly logger = new Logger(TransporteDeWhatsappFake.name);
  readonly enviadas: MensagemDoFake[] = [];
  private proximo = 1;

  async enviar(mensagem: {
    tenantId: string;
    telefone: string;
    texto: string;
  }): Promise<{ idExterno: string }> {
    const idExterno = `wamid.fake.${String(this.proximo++).padStart(6, '0')}`;
    this.enviadas.push({ ...mensagem, idExterno });
    // Sem telefone nem texto no log: são dados do aluno.
    this.logger.log({ idExterno }, 'Mensagem de WhatsApp guardada pelo adapter fake');
    return { idExterno };
  }

  doTenant(tenantId: string): MensagemDoFake[] {
    return this.enviadas.filter((mensagem) => mensagem.tenantId === tenantId);
  }
}
