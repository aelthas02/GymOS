import { Injectable } from '@nestjs/common';
import type { EventoDeDominio, TipoDeEvento } from '@gymos/shared-events';
import { CacheComTenant, type OpcoesDoCache, type ParteDaChave } from '../../application/eventos';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { RegistroDeConsumidores } from '../eventos/registro-de-consumidores';
import { ConexaoRedis } from '../filas/conexao-redis';
import { chaveDeCache } from './chave-de-cache';

/** Valor embrulhado: guarda também `undefined` e `null` sem confundir com ausência. */
interface Guardado<T> {
  v: T;
}

@Injectable()
export class CacheComTenantRedis extends CacheComTenant {
  constructor(
    private readonly conexao: ConexaoRedis,
    private readonly contexto: ContextoDoTenant,
    private readonly registro: RegistroDeConsumidores,
  ) {
    super();
  }

  async obter<T>(
    chave: readonly ParteDaChave[],
    carregar: () => Promise<T>,
    { ttlSegundos }: OpcoesDoCache,
  ): Promise<T> {
    const completa = this.chave(this.contexto.tenant().id, chave);
    const guardado = await this.conexao.cliente().get(completa);
    if (guardado !== null) {
      return (JSON.parse(guardado) as Guardado<T>).v;
    }
    const valor = await carregar();
    await this.conexao
      .cliente()
      .set(completa, JSON.stringify({ v: valor } satisfies Guardado<T>), 'EX', ttlSegundos);
    return valor;
  }

  async invalidar(chave: readonly ParteDaChave[]): Promise<void> {
    await this.conexao.cliente().unlink(this.chave(this.contexto.tenant().id, chave));
  }

  invalidarAoReceber<T extends TipoDeEvento>(
    evento: T,
    nomeDoConsumidor: string,
    chaves: (evento: EventoDeDominio<T>) => ReadonlyArray<readonly ParteDaChave[]>,
  ): void {
    this.registro.registrar({
      nome: nomeDoConsumidor,
      evento,
      tratar: async (recebido) => {
        const completas = chaves(recebido).map((chave) => this.chave(recebido.tenantId, chave));
        if (completas.length > 0) {
          await this.conexao.cliente().unlink(...completas);
        }
      },
    });
  }

  private chave(tenantId: string, chave: readonly ParteDaChave[]): string {
    return `${this.conexao.prefixo}:${chaveDeCache(tenantId, ...chave)}`;
  }
}
