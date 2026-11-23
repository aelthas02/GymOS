import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarTenant, criarUnidade, type TenantCriado } from '../../testing/fabricas';
import { ContextoDoTenant } from './contexto-do-tenant';
import {
  ExecutorDeTenant,
  TenantAninhadoError,
  TenantDesconhecidoError,
} from './executor-de-tenant';

describe('ExecutorDeTenant: isolamento', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let executor: ExecutorDeTenant;
  let contexto: ContextoDoTenant;
  let a: TenantCriado;
  let b: TenantCriado;
  let c: TenantCriado;

  const nomesVisiveis = async () =>
    (await contexto.cliente().unidade.findMany({ orderBy: { nome: 'asc' } })).map((u) => u.nome);

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    executor = app.get(ExecutorDeTenant);
    contexto = app.get(ContextoDoTenant);
    const conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    b = await criarTenant(conexao);
    c = await criarTenant(conexao);
    for (const [tenant, nome] of [
      [a, 'Unidade A'],
      [b, 'Unidade B'],
      [c, 'Unidade C'],
    ] as const) {
      await criarUnidade(conexao, tenant.id, nome);
    }
  });

  it('com UUID inexistente lança TenantDesconhecidoError e não executa a função', async () => {
    const job = vi.fn();

    await expect(executor.runAsTenant(randomUUID(), job)).rejects.toThrow(TenantDesconhecidoError);
    expect(job).not.toHaveBeenCalled();
  });

  it('aninhado com outro tenant lança TenantAninhadoError e não executa a função interna', async () => {
    const interno = vi.fn();

    const externo = executor.runAsTenant(a.id, () => executor.runAsTenant(b.id, interno));

    await expect(externo).rejects.toThrow(TenantAninhadoError);
    expect(interno).not.toHaveBeenCalled();
  });

  it('aninhado com o mesmo tenant reaproveita o contexto', async () => {
    const nomes = await executor.runAsTenant(a.id, () => executor.runAsTenant(a.id, nomesVisiveis));

    expect(nomes).toEqual(['Unidade A']);
  });

  it('depois de um erro, o próximo job de outro tenant roda e só vê os próprios dados', async () => {
    await expect(
      executor.runAsTenant(a.id, () => Promise.reject(new Error('falhou'))),
    ).rejects.toThrow('falhou');

    expect(await executor.runAsTenant(b.id, nomesVisiveis)).toEqual(['Unidade B']);
  });

  describe('paraCadaTenant', () => {
    it('visita cada tenant uma vez e cada execução só vê os próprios dados', async () => {
      const visitas = await executor.paraCadaTenant(async (tenant) => ({
        id: tenant.id,
        nomes: await nomesVisiveis(),
      }));

      expect(visitas.map((v) => v.id).sort()).toEqual([a.id, b.id, c.id].sort());
      const nomesDe = (id: string) => visitas.find((v) => v.id === id)?.nomes;
      expect(nomesDe(a.id)).toEqual(['Unidade A']);
      expect(nomesDe(b.id)).toEqual(['Unidade B']);
      expect(nomesDe(c.id)).toEqual(['Unidade C']);
    });

    it('a falha de um tenant não impede os outros e sobe num AggregateError', async () => {
      const visitados: string[] = [];

      const erro: unknown = await executor
        .paraCadaTenant(async (tenant) => {
          visitados.push(tenant.id);
          if (tenant.id === b.id) {
            throw new Error(`falha em ${tenant.slug}`);
          }
          return tenant.id;
        })
        .then(
          () => null,
          (e: unknown) => e,
        );

      expect(erro).toBeInstanceOf(AggregateError);
      expect((erro as AggregateError).errors.map((e: Error) => e.message)).toEqual([
        `falha em ${b.slug}`,
      ]);
      expect(visitados.sort()).toEqual([a.id, b.id, c.id].sort());
    });

    it('várias falhas são todas reportadas', async () => {
      const erro: unknown = await executor
        .paraCadaTenant(() => Promise.reject(new Error('x')))
        .then(
          () => null,
          (e: unknown) => e,
        );

      expect((erro as AggregateError).errors).toHaveLength(3);
    });
  });
});
