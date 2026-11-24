import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ProvedorDeChaves } from '../../application/protecao-de-dados';

const ALGORITMO = 'aes-256-gcm';

export class ChaveMestraDesconhecidaError extends Error {
  constructor(idDaChaveMestra: string) {
    super(`Envelope de outra chave mestra (${idDaChaveMestra}): não há como desenvelopar aqui.`);
    this.name = 'ChaveMestraDesconhecidaError';
  }
}

/**
 * Chave mestra num env (dev, teste e staging). Envelope `iv.tag.chave` em base64url, cifrado com
 * AES-256-GCM; o id identifica a chave mestra pelo começo do seu SHA-256, sem revelá-la.
 */
export class ProvedorDeChavesLocal extends ProvedorDeChaves {
  private readonly chaveMestra: Buffer;
  readonly idDaChaveMestra: string;

  constructor(chaveMestraEmBase64: string) {
    super();
    this.chaveMestra = Buffer.from(chaveMestraEmBase64, 'base64');
    const digest = createHash('sha256').update(this.chaveMestra).digest('hex');
    this.idDaChaveMestra = `local:${digest.slice(0, 16)}`;
  }

  async envelopar(chave: Buffer): Promise<{ envelope: string; idDaChaveMestra: string }> {
    const iv = randomBytes(12);
    const cifra = createCipheriv(ALGORITMO, this.chaveMestra, iv);
    cifra.setAAD(Buffer.from(this.idDaChaveMestra));
    const cifrada = Buffer.concat([cifra.update(chave), cifra.final()]);
    const envelope = [iv, cifra.getAuthTag(), cifrada]
      .map((parte) => parte.toString('base64url'))
      .join('.');
    return { envelope, idDaChaveMestra: this.idDaChaveMestra };
  }

  async desenvelopar(envelope: string, idDaChaveMestra: string): Promise<Buffer> {
    if (idDaChaveMestra !== this.idDaChaveMestra) {
      throw new ChaveMestraDesconhecidaError(idDaChaveMestra);
    }
    const [iv = '', tag = '', cifrada = ''] = envelope.split('.');
    const decifra = createDecipheriv(ALGORITMO, this.chaveMestra, Buffer.from(iv, 'base64url'), {
      authTagLength: 16,
    });
    decifra.setAAD(Buffer.from(this.idDaChaveMestra));
    decifra.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decifra.update(Buffer.from(cifrada, 'base64url')), decifra.final()]);
  }
}
