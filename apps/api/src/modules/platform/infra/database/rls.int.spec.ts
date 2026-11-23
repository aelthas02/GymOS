import type { Client } from 'pg';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { comTenant, criarTenant, criarUnidade, type TenantCriado } from '../../testing/fabricas';
import { transacaoDoTenant } from '../contexto/transacao-do-tenant';
import { criarClientePrisma } from '../prisma/criar-cliente';

describe('RLS por tenant (papel gymos_app)', () => {
  const banco = usarBancoDeTeste();
  let app: Client;
  let a: TenantCriado;
  let b: TenantCriado;

  beforeAll(async () => {
    app = await banco.conectarComoApp();
    a = await criarTenant(app);
    b = await criarTenant(app);
    await criarUnidade(app, a.id, 'Unidade A1');
    await criarUnidade(app, a.id, 'Unidade A2');
    await criarUnidade(app, b.id, 'Unidade B1');
  });

  it('com app.tenant_id = A, SELECT sem WHERE retorna só as unidades de A', async () => {
    const nomes = await comTenant(app, a.id, async () => {
      const { rows } = await app.query<{ nome: string }>('SELECT nome FROM unidade ORDER BY nome');
      return rows.map((row) => row.nome);
    });

    expect(nomes).toEqual(['Unidade A1', 'Unidade A2']);
  });

  it('INSERT com tenant_id de B no contexto de A falha pela política', async () => {
    const inserir = comTenant(app, a.id, () =>
      app.query('INSERT INTO unidade (tenant_id, nome) VALUES ($1, $2)', [b.id, 'Intrusa']),
    );

    await expect(inserir).rejects.toThrow(/row-level security/);
  });

  it('conexão sem app.tenant_id lê zero linhas e não lança erro', async () => {
    const { rows } = await app.query('SELECT * FROM unidade');

    expect(rows).toEqual([]);
  });

  it('a mesma conexão do pool atende A e depois B sem vazar, e sem contexto vê zero linhas', async () => {
    const prisma = criarClientePrisma(banco.urlApp, { maxConexoes: 1 });
    banco.aoFinal(() => prisma.$disconnect());
    const lerNaTransacao = async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const [{ pid }] = await tx.$queryRaw<[{ pid: number }]>`SELECT pg_backend_pid() AS pid`;
      const unidades = await tx.unidade.findMany({ orderBy: { nome: 'asc' } });
      return { pid, nomes: unidades.map((unidade) => unidade.nome) };
    };

    const deA = await transacaoDoTenant(prisma, a.id, lerNaTransacao);
    const deB = await transacaoDoTenant(prisma, b.id, lerNaTransacao);
    const semContexto = await prisma.$transaction(lerNaTransacao);

    expect(new Set([deA.pid, deB.pid, semContexto.pid]).size).toBe(1);
    expect(deA.nomes).toEqual(['Unidade A1', 'Unidade A2']);
    expect(deB.nomes).toEqual(['Unidade B1']);
    expect(semContexto.nomes).toEqual([]);
  });
});
