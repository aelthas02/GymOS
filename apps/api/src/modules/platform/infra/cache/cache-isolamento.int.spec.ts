import type { INestApplicationContext } from '@nestjs/common';
import type { EventoDeDominio } from '@gymos/shared-events';
import { randomUUID } from 'node:crypto';
import { CacheComTenant } from '../../application/eventos';
import type { Tenant } from '../../domain/tenant';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarModuloDeEventos, tenantFicticio } from '../../testing/eventos-de-teste';
import { usarRedisDeTeste } from '../../testing/redis-de-teste';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { RegistroDeConsumidores } from '../eventos/registro-de-consumidores';
import { ChaveDeCacheInvalidaError } from './chave-de-cache';

describe('isolamento do cache por tenant', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let modulo: INestApplicationContext;
  const academiaA = tenantFicticio('academia-a');
  const academiaB = tenantFicticio('academia-b');
  const opcoes = { ttlSegundos: 60 };

  beforeAll(async () => {
    modulo = await criarModuloDeEventos(banco, redis);
  });

  const noTenant = <T>(tenant: Tenant, fn: (cache: CacheComTenant) => Promise<T>): Promise<T> =>
    modulo.get(ContextoDoTenant).executar({ tenant }, () => fn(modulo.get(CacheComTenant)));

  /** Devolve o valor em cache ou 'faltou' se foi preciso carregar. */
  const ler = (tenant: Tenant, chave: string[]) =>
    noTenant(tenant, (cache) => cache.obter(chave, () => Promise.resolve('faltou'), opcoes));

  const guardar = (tenant: Tenant, chave: string[], valor: unknown) =>
    noTenant(tenant, (cache) => cache.obter(chave, () => Promise.resolve(valor), opcoes));

  it('invalidar em A não afeta B', async () => {
    await guardar(academiaA, ['inv'], 'a');
    await guardar(academiaB, ['inv'], 'b');

    await noTenant(academiaA, (cache) => cache.invalidar(['inv']));

    expect(await ler(academiaA, ['inv'])).toBe('faltou');
    expect(await ler(academiaB, ['inv'])).toBe('b');
  });

  it('invalidarAoReceber apaga só no tenant do evento', async () => {
    await guardar(academiaA, ['evt', '1'], 'a');
    await guardar(academiaB, ['evt', '1'], 'b');
    modulo
      .get(CacheComTenant)
      .invalidarAoReceber('PagamentoConfirmado', 'teste.invalida-cache', () => [['evt', '1']]);

    await modulo
      .get(RegistroDeConsumidores)
      .consumidor('teste.invalida-cache')
      ?.tratar({
        id: randomUUID(),
        tipo: 'PagamentoConfirmado',
        versao: 1,
        tenantId: academiaA.id,
        ocorridoEm: '2026-11-23T14:00:00.000Z',
        payload: {},
      } as unknown as EventoDeDominio);

    expect(await ler(academiaA, ['evt', '1'])).toBe('faltou');
    expect(await ler(academiaB, ['evt', '1'])).toBe('b');
  });

  it('chave com parte inválida ou sem partes é recusada', async () => {
    for (const chave of [['a:b'], ['tenant:x'], ['*'], []]) {
      await expect(guardar(academiaA, chave, 1)).rejects.toBeInstanceOf(ChaveDeCacheInvalidaError);
    }
  });

  it('sem tenant no contexto, o acesso ao cache é recusado', async () => {
    await expect(modulo.get(CacheComTenant).invalidar(['sem-tenant'])).rejects.toThrow();
  });

  it('guarda null e undefined sem recarregar', async () => {
    for (const valor of [null, undefined]) {
      const chave = [`vazio-${String(valor)}`];
      await guardar(academiaA, chave, valor);
      const carregar = () => Promise.reject(new Error('devia vir do cache'));

      const lido = await noTenant(academiaA, (cache) => cache.obter(chave, carregar, opcoes));

      expect(lido).toBe(valor);
    }
  });
});
