import { Injectable, Logger } from '@nestjs/common';
import { TempoRealPorTenant } from '../../application/eventos';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ConexaoRedis } from '../filas/conexao-redis';

const TOPICO = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;

export class TopicoInvalidoError extends Error {
  constructor(topico: string) {
    super(`Tópico de tempo real inválido: "${topico}" (use minúsculas, números, - e .).`);
    this.name = 'TopicoInvalidoError';
  }
}

/** Canal de um tópico de um tenant: `tenant:<id>:<topico>`, sob o prefixo do ambiente. */
export function canalDoTenant(prefixo: string, tenantId: string, topico: string): string {
  if (!TOPICO.test(topico)) {
    throw new TopicoInvalidoError(topico);
  }
  return `${prefixo}:tenant:${tenantId}:${topico}`;
}

/**
 * Pub/sub do Redis por tenant, para o SSE e a Recepção. Uma conexão de assinaturas por processo;
 * cada canal tem os seus ouvintes, e o canal sai do Redis quando o último cancela.
 */
@Injectable()
export class TempoRealRedis extends TempoRealPorTenant {
  private readonly logger = new Logger(TempoRealRedis.name);
  private readonly ouvintes = new Map<string, Set<(mensagem: unknown) => void>>();
  private escutando = false;

  constructor(
    private readonly conexao: ConexaoRedis,
    private readonly contexto: ContextoDoTenant,
  ) {
    super();
  }

  async publicar(topico: string, mensagem: unknown): Promise<void> {
    const canal = canalDoTenant(this.conexao.prefixo, this.contexto.tenant().id, topico);
    await this.conexao.cliente().publish(canal, JSON.stringify(mensagem));
  }

  async assinar(
    topico: string,
    aoReceber: (mensagem: unknown) => void,
  ): Promise<() => Promise<void>> {
    const canal = canalDoTenant(this.conexao.prefixo, this.contexto.tenant().id, topico);
    const assinante = this.conexao.assinante();
    this.escutar();
    let doCanal = this.ouvintes.get(canal);
    if (!doCanal) {
      doCanal = new Set();
      this.ouvintes.set(canal, doCanal);
      await assinante.subscribe(canal);
    }
    doCanal.add(aoReceber);
    return async () => {
      const atuais = this.ouvintes.get(canal);
      if (!atuais?.delete(aoReceber) || atuais.size > 0) {
        return;
      }
      this.ouvintes.delete(canal);
      await assinante.unsubscribe(canal);
    };
  }

  private escutar(): void {
    if (this.escutando) {
      return;
    }
    this.escutando = true;
    this.conexao.assinante().on('message', (canal: string, bruta: string) => {
      for (const ouvinte of this.ouvintes.get(canal) ?? []) {
        try {
          ouvinte(JSON.parse(bruta));
        } catch (err) {
          this.logger.warn({ err, canal }, 'Ouvinte de tempo real falhou');
        }
      }
    });
  }
}
