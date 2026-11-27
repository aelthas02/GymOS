import type { INestApplicationContext } from '@nestjs/common';
import { vi } from 'vitest';
import { ACADEMIA_RITMO } from '../../seed/plataforma';
import { MODULOS_DE_SEED } from '../../seed/modulos';
import { executarSeed } from '../../seed/runner';
import { AcessoModule } from '../acesso/acesso.module';
import { AlunosModule } from '../alunos/alunos.module';
import { AvisosModule } from '../avisos/avisos.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { FuncionariosModule } from '../funcionarios/funcionarios.module';
import { RepositorioDeTenants } from '../platform/application/portas';
import { Relogio } from '../platform/domain/relogio';
import { ExecutorDeTenant } from '../platform/infra/contexto/executor-de-tenant';
import { ProtecaoDeDadosModule } from '../platform/protecao-de-dados.module';
import { usarBancoDeTeste } from '../platform/testing/banco-de-teste';
import { criarModuloDeEventos } from '../platform/testing/eventos-de-teste';
import { usarRedisDeTeste } from '../platform/testing/redis-de-teste';
import { Financeiro } from './application/financeiro';
import { Lancamentos } from './application/lancamentos';
import { FinanceiroModule } from './financeiro.module';

// Consultas do T21 com o seed de 19/11/2026: totais coerentes entre as visões, lançamento novo e cache.
describe('Financeiro (visões, rateio e cache)', () => {
  const banco = usarBancoDeTeste();
  const redis = usarRedisDeTeste();
  let app: INestApplicationContext;
  let tenantId: string;
  const executor = { usuarioId: '00000000-0000-4000-8000-000000000001' };

  const noTenant = <T>(corpo: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenantId, corpo);
  const pedido = { periodo: 'este-mes' as const, filtro: {} };

  beforeAll(async () => {
    app = await criarModuloDeEventos(banco, redis, {}, [
      ProtecaoDeDadosModule,
      AlunosModule,
      FuncionariosModule,
      AvisosModule,
      AcessoModule,
      FiscalModule,
      FinanceiroModule,
    ]);
    vi.spyOn(app.get(Relogio), 'agora').mockImplementation(
      () => new Date('2026-11-19T09:00:00-03:00'),
    );
    await executarSeed(app, MODULOS_DE_SEED);
    const tenant = await app.get(RepositorioDeTenants).porSlug(ACADEMIA_RITMO.slug);
    tenantId = tenant?.id ?? '';
  });

  it('visão geral: líquida = bruta − taxas − despesas, com folha e lançamentos, e série de 6 meses', async () => {
    const geral = await noTenant(() => app.get(Financeiro).geral(pedido));

    expect(geral.periodo).toMatchObject({
      de: '2026-11-01',
      ate: '2026-11-30',
      rotulo: 'Novembro 2026',
    });
    expect(geral.brutaCentavos).toBeGreaterThan(0);
    expect(geral.receitaLiquida.centavos).toBe(
      geral.brutaCentavos - geral.taxasCentavos - geral.despesasCentavos,
    );
    // Folha ativa do seed (R$ 2.300) + aluguel, contas e outros de novembro (R$ 2.200).
    expect(geral.despesasPorCategoria.find((c) => c.categoria === 'folha')?.centavos).toBe(230_000);
    expect(geral.despesasCentavos).toBe(230_000 + 120_000 + 60_000 + 40_000);
    expect(geral.serieMensal.map((ponto) => ponto.mes)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(geral.porForma.reduce((soma, forma) => soma + forma.percentual, 0)).toBe(100);
    expect(geral.inadimplencia.emAtraso).toBeGreaterThan(0);
  });

  it('setores: a soma dos setores é a receita bruta e os pesos somam 100', async () => {
    const { geral, setores } = await noTenant(async () => ({
      geral: await app.get(Financeiro).geral(pedido),
      setores: await app.get(Financeiro).visao('setores', pedido),
    }));
    const receitas = setores.tabela.linhas.map((linha) => Number(linha.celulas['receita']));
    const pesos = setores.tabela.linhas.map((linha) => Number(linha.celulas['peso']));

    expect(receitas.reduce((soma, valor) => soma + valor, 0)).toBe(geral.brutaCentavos);
    expect(pesos.reduce((soma, valor) => soma + valor, 0)).toBe(100);
  });

  it('demais visões respondem com a mesma forma (aulas e professores vazios até o T28)', async () => {
    const visoes = await noTenant(async () => ({
      funcionarios: await app.get(Financeiro).visao('funcionarios', pedido),
      alunos: await app.get(Financeiro).visao('alunos', pedido, { limite: 3 }),
      aulas: await app.get(Financeiro).visao('aulas', pedido),
      planos: await app.get(Financeiro).visao('planos', pedido),
      formas: await app.get(Financeiro).visao('formas-de-pagamento', pedido),
    }));

    expect(visoes.funcionarios.tabela.total).toBeGreaterThan(0);
    expect(visoes.alunos.tabela.linhas).toHaveLength(3);
    expect(visoes.alunos.tabela.proximoCursor).not.toBeNull();
    expect(visoes.aulas.tabela.linhas).toEqual([]);
    expect(visoes.planos.tabela.total).toBeGreaterThan(0);
    expect(visoes.formas.tabela.total).toBeGreaterThan(0);
  });

  it('lançamento novo invalida o cache do tenant e entra nas despesas', async () => {
    const antes = await noTenant(() => app.get(Financeiro).geral(pedido));

    await noTenant(() =>
      app.get(Lancamentos).registrar(executor, {
        tipo: 'despesa',
        categoria: 'contas',
        valorCentavos: 10_000,
        data: '2026-11-15',
      }),
    );
    const depois = await noTenant(() => app.get(Financeiro).geral(pedido));

    expect(depois.despesasCentavos).toBe(antes.despesasCentavos + 10_000);
  });

  it('receita sem setor e valor zero são recusados', async () => {
    await expect(
      noTenant(() =>
        app.get(Lancamentos).registrar(executor, {
          tipo: 'receita',
          categoria: 'outros',
          valorCentavos: 5_000,
          data: '2026-11-15',
        }),
      ),
    ).rejects.toThrow('setor');
    await expect(
      noTenant(() =>
        app.get(Lancamentos).registrar(executor, {
          tipo: 'despesa',
          categoria: 'outros',
          valorCentavos: 0,
          data: '2026-11-15',
        }),
      ),
    ).rejects.toThrow('valor');
  });
});
