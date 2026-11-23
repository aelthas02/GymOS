import type { INestApplication } from '@nestjs/common';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarTenant, criarUnidade, type TenantCriado } from '../../testing/fabricas';
import { ContextoDoTenant } from './contexto-do-tenant';
import { ExecutorDeTenant, TenantObrigatorioError } from './executor-de-tenant';

describe('runAsTenant', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let executor: ExecutorDeTenant;
  let contexto: ContextoDoTenant;
  let a: TenantCriado;

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    executor = app.get(ExecutorDeTenant);
    contexto = app.get(ContextoDoTenant);
    const conexao = await banco.conectarComoApp();
    a = await criarTenant(conexao);
    const b = await criarTenant(conexao);
    await criarUnidade(conexao, a.id, 'Centro A');
    await criarUnidade(conexao, b.id, 'Centro B');
  });

  it.each([undefined, null, ''])('com tenant %j lança erro e não executa a função', async (id) => {
    const job = vi.fn();

    await expect(executor.runAsTenant(id, job)).rejects.toThrow(TenantObrigatorioError);
    expect(job).not.toHaveBeenCalled();
  });

  it('com tenant, o job só enxerga os dados dele', async () => {
    const nomes = await executor.runAsTenant(a.id, async () => {
      const unidades = await contexto.cliente().unidade.findMany();
      return unidades.map((unidade) => unidade.nome);
    });

    expect(nomes).toEqual(['Centro A']);
  });
});
