import { Injectable, Logger } from '@nestjs/common';
import { type Email, EnvioDeEmail } from '../../application/portas';

/** Guarda os e-mails em memória, para testes e máquinas sem Mailpit. Determinístico. */
@Injectable()
export class EnvioDeEmailFake extends EnvioDeEmail {
  private readonly logger = new Logger(EnvioDeEmailFake.name);
  readonly enviados: Email[] = [];

  async enviar(email: Email): Promise<void> {
    this.enviados.push(email);
    // Sem o texto: os links levam tokens de uso único.
    this.logger.log(`E-mail "${email.assunto}" guardado pelo adapter fake.`);
  }

  ultimaPara(para: string): Email | undefined {
    return [...this.enviados].reverse().find((email) => email.para === para);
  }
}
