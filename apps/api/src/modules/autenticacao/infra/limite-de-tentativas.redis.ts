import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { type Contador, LimiteDeTentativas } from '../application/portas';
import { CONFIGURACAO_DA_AUTENTICACAO, type ConfiguracaoDaAutenticacao } from './configuracao';

/**
 * Janela deslizante num sorted set por contador: cada falha entra com o instante do Relogio como
 * score; as mais velhas que a janela saem antes de contar. A chave expira sozinha depois da janela.
 */
@Injectable()
export class LimiteDeTentativasRedis extends LimiteDeTentativas implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    @Inject(CONFIGURACAO_DA_AUTENTICACAO) private readonly config: ConfiguracaoDaAutenticacao,
  ) {
    super();
    this.redis = new Redis(config.urlDoRedis, { lazyConnect: true, maxRetriesPerRequest: 2 });
    // Sem Redis o login falha fechado (500); o erro chega pela promessa do comando.
    this.redis.on('error', () => undefined);
  }

  private chave(contador: Contador): string {
    return `${this.config.prefixoDoRedis}:login:${contador.chave}`;
  }

  async bloqueado(contadores: readonly Contador[], agora: Date): Promise<boolean> {
    const multi = this.redis.multi();
    for (const contador of contadores) {
      multi.zcount(this.chave(contador), agora.getTime() - contador.janelaMs, '+inf');
    }
    const respostas = (await multi.exec()) ?? [];
    return contadores.some((contador, i) => Number(respostas[i]?.[1] ?? 0) >= contador.limite);
  }

  async registrarFalha(contadores: readonly Contador[], agora: Date): Promise<void> {
    const multi = this.redis.multi();
    for (const contador of contadores) {
      const chave = this.chave(contador);
      multi
        .zremrangebyscore(chave, '-inf', agora.getTime() - contador.janelaMs)
        .zadd(chave, agora.getTime(), randomUUID())
        .pexpire(chave, contador.janelaMs);
    }
    await multi.exec();
  }

  async limpar(contador: Contador): Promise<void> {
    await this.redis.del(this.chave(contador));
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}
