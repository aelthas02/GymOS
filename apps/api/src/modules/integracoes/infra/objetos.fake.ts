import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ObjetosDeArmazenamento } from '../application/portas';
import { CONFIGURACAO_DAS_INTEGRACOES, type ConfiguracaoDasIntegracoes } from './configuracao';

export interface ObjetoGuardado {
  conteudo: Buffer;
  tipo: string;
}

/**
 * Armazenamento fake (T13d): objetos em memória e URLs assinadas servidas pela própria API
 * (`/api/arquivos/baixar`). A assinatura cobre a chave e o prazo: trocar a chave invalida a URL.
 */
@Injectable()
export class ObjetosDeArmazenamentoFake extends ObjetosDeArmazenamento {
  private readonly objetos = new Map<string, ObjetoGuardado>();

  constructor(
    @Inject(CONFIGURACAO_DAS_INTEGRACOES) private readonly config: ConfiguracaoDasIntegracoes,
  ) {
    super();
  }

  async gravar(chave: string, conteudo: Buffer, tipo: string): Promise<void> {
    this.objetos.set(chave, { conteudo, tipo });
  }

  async remover(chave: string): Promise<void> {
    this.objetos.delete(chave);
  }

  async ler(chave: string): Promise<Buffer | null> {
    return this.objetos.get(chave)?.conteudo ?? null;
  }

  async urlAssinada(chave: string, expiraEm: Date): Promise<string> {
    const expira = String(expiraEm.getTime());
    const consulta = new URLSearchParams({
      chave,
      expira,
      assinatura: this.assinar(chave, expira),
    });
    return `${this.config.urlPublica}/api/arquivos/baixar?${consulta.toString()}`;
  }

  /** O objeto, se a assinatura vale para esta chave e o prazo não passou; senão null. */
  abrir(chave: string, expira: string, assinatura: string, agora: Date): ObjetoGuardado | null {
    const esperada = Buffer.from(this.assinar(chave, expira));
    const recebida = Buffer.from(assinatura);
    if (
      recebida.length !== esperada.length ||
      !timingSafeEqual(recebida, esperada) ||
      Number(expira) <= agora.getTime()
    ) {
      return null;
    }
    return this.objetos.get(chave) ?? null;
  }

  tem(chave: string): boolean {
    return this.objetos.has(chave);
  }

  private assinar(chave: string, expira: string): string {
    return createHmac('sha256', this.config.segredoInterno)
      .update(`arquivo:${chave}|${expira}`)
      .digest('hex');
  }
}
