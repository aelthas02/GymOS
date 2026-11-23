import { Inject, Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { type Email, EnvioDeEmail } from '../../application/portas';
import { CONFIGURACAO_DA_AUTENTICACAO, type ConfiguracaoDaAutenticacao } from '../configuracao';

/** SMTP (Mailpit em dev; o provedor de e-mail transacional em staging e produção). */
@Injectable()
export class EnvioDeEmailSmtp extends EnvioDeEmail {
  private readonly transporte: Transporter;

  constructor(
    @Inject(CONFIGURACAO_DA_AUTENTICACAO) private readonly config: ConfiguracaoDaAutenticacao,
  ) {
    super();
    this.transporte = createTransport({ host: config.smtp.host, port: config.smtp.porta });
  }

  async enviar(email: Email): Promise<void> {
    await this.transporte.sendMail({
      from: this.config.remetente,
      to: email.para,
      subject: email.assunto,
      text: email.texto,
    });
  }
}
