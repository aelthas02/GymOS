import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import {
  comTenant,
  criarReferenciaExterna,
  criarTenant,
  criarUnidade,
  type TenantCriado,
} from '../../testing/fabricas';
import { transacaoDoTenant } from '../contexto/transacao-do-tenant';
import { criarClientePrisma } from '../prisma/criar-cliente';

describe('isolamento por RLS: casos de borda (papel gymos_app)', () => {
  const banco = usarBancoDeTeste();
  let app: Client;
  let a: TenantCriado;
  let b: TenantCriado;
  let unidadeB: string;
  let referenciaB: string;

  const nomesDeUnidadesDe = (tenantId: string) =>
    comTenant(app, tenantId, async () => {
      const { rows } = await app.query<{ nome: string }>('SELECT nome FROM unidade');
      return rows.map((row) => row.nome);
    });

  beforeAll(async () => {
    app = await banco.conectarComoApp();
    a = await criarTenant(app);
    b = await criarTenant(app);
    await criarUnidade(app, a.id, 'Unidade A');
    unidadeB = await criarUnidade(app, b.id, 'Unidade B');
    referenciaB = await criarReferenciaExterna(app, b.id, {
      provedor: 'fake',
      idExterno: 'ext-iso-b',
      recurso: 'exemplo',
      recursoId: randomUUID(),
    });
  });

  describe('UPDATE e DELETE sobre linhas de outro tenant', () => {
    it('UPDATE em unidade de B no contexto de A afeta 0 linhas', async () => {
      const resultado = await comTenant(app, a.id, () =>
        app.query('UPDATE unidade SET nome = $1 WHERE id = $2', ['Invadida', unidadeB]),
      );

      expect(resultado.rowCount).toBe(0);
      expect(await nomesDeUnidadesDe(b.id)).toEqual(['Unidade B']);
    });

    it('DELETE em unidade de B no contexto de A afeta 0 linhas', async () => {
      const resultado = await comTenant(app, a.id, () =>
        app.query('DELETE FROM unidade WHERE id = $1', [unidadeB]),
      );

      expect(resultado.rowCount).toBe(0);
      expect(await nomesDeUnidadesDe(b.id)).toEqual(['Unidade B']);
    });

    it('UPDATE em referencia_externa de B no contexto de A afeta 0 linhas', async () => {
      const resultado = await comTenant(app, a.id, () =>
        app.query("UPDATE referencia_externa SET ultimo_evento = 'x' WHERE id = $1", [referenciaB]),
      );

      expect(resultado.rowCount).toBe(0);
    });

    it('DELETE em referencia_externa de B no contexto de A afeta 0 linhas', async () => {
      const resultado = await comTenant(app, a.id, () =>
        app.query('DELETE FROM referencia_externa WHERE id = $1', [referenciaB]),
      );

      expect(resultado.rowCount).toBe(0);
      const restantes = await comTenant(app, b.id, () =>
        app.query('SELECT id FROM referencia_externa WHERE id = $1', [referenciaB]),
      );
      expect(restantes.rowCount).toBe(1);
    });

    it('UPDATE que move uma unidade de A para o tenant_id de B falha pelo WITH CHECK', async () => {
      const mover = comTenant(app, a.id, () =>
        app.query('UPDATE unidade SET tenant_id = $1 WHERE nome = $2', [b.id, 'Unidade A']),
      );

      await expect(mover).rejects.toThrow(/row-level security/);
    });

    it('UPDATE que move uma referencia_externa de A para o tenant_id de B falha pelo WITH CHECK', async () => {
      const referenciaA = await criarReferenciaExterna(app, a.id, {
        provedor: 'fake',
        idExterno: 'ext-iso-a',
        recurso: 'exemplo',
        recursoId: randomUUID(),
      });

      const mover = comTenant(app, a.id, () =>
        app.query('UPDATE referencia_externa SET tenant_id = $1 WHERE id = $2', [
          b.id,
          referenciaA,
        ]),
      );

      await expect(mover).rejects.toThrow(/row-level security/);
    });
  });

  describe('valores de app.tenant_id', () => {
    const lerComContexto = async (valor: string) => {
      await app.query('BEGIN');
      try {
        await app.query("SELECT set_config('app.tenant_id', $1, true)", [valor]);
        return await app.query('SELECT * FROM unidade');
      } finally {
        await app.query('ROLLBACK');
      }
    };

    it("com app.tenant_id = '' lê zero linhas e não lança erro", async () => {
      const resultado = await lerComContexto('');

      expect(resultado.rows).toEqual([]);
    });

    it('com UUID inexistente lê zero linhas e não lança erro', async () => {
      const resultado = await lerComContexto(randomUUID());

      expect(resultado.rows).toEqual([]);
    });

    it('com valor que não é UUID lança erro de sintaxe (falha fechado, não vaza linhas)', async () => {
      await expect(lerComContexto('nao-e-um-uuid')).rejects.toThrow(
        /invalid input syntax for type uuid/,
      );
    });

    it("INSERT com app.tenant_id = '' falha pela política", async () => {
      await app.query('BEGIN');
      try {
        await app.query("SELECT set_config('app.tenant_id', '', true)");
        await expect(
          app.query('INSERT INTO unidade (tenant_id, nome) VALUES ($1, $2)', [
            a.id,
            'Sem contexto',
          ]),
        ).rejects.toThrow(/row-level security/);
      } finally {
        await app.query('ROLLBACK');
      }
    });
  });

  it('transação com ROLLBACK não deixa app.tenant_id na conexão do pool', async () => {
    const prisma = criarClientePrisma(banco.urlApp, { maxConexoes: 1 });
    banco.aoFinal(() => prisma.$disconnect());
    const ler = async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const [{ pid, contexto }] = await tx.$queryRaw<[{ pid: number; contexto: string | null }]>`
        SELECT pg_backend_pid() AS pid, current_setting('app.tenant_id', true) AS contexto`;
      const unidades = await tx.unidade.findMany();
      return { pid, contexto, linhas: unidades.length };
    };

    let pidDentro = 0;
    const dentro = transacaoDoTenant(prisma, a.id, async (tx) => {
      const lido = await ler(tx);
      pidDentro = lido.pid;
      expect(lido.linhas).toBe(1);
      throw new Error('falha de propósito');
    });
    await expect(dentro).rejects.toThrow('falha de propósito');
    const depois = await prisma.$transaction(ler);

    expect(depois.pid).toBe(pidDentro);
    expect(depois.contexto ?? '').toBe('');
    expect(depois.linhas).toBe(0);
  });

  describe('privilégios do gymos_app', () => {
    it('não faz SELECT direto na tabela tenant', async () => {
      await expect(app.query('SELECT * FROM tenant')).rejects.toThrow(/permission denied/);
    });

    it('não faz UPDATE direto na tabela tenant', async () => {
      await expect(app.query("UPDATE tenant SET nome = 'x'")).rejects.toThrow(/permission denied/);
    });

    it('não consegue assumir o papel do dono com SET ROLE', async () => {
      await expect(app.query('SET ROLE gymos_migrator')).rejects.toThrow(/permission denied/);
    });

    it('não consegue desligar o RLS nem o FORCE', async () => {
      await expect(app.query('ALTER TABLE unidade DISABLE ROW LEVEL SECURITY')).rejects.toThrow(
        /must be owner/,
      );
      await expect(app.query('ALTER TABLE unidade NO FORCE ROW LEVEL SECURITY')).rejects.toThrow(
        /must be owner/,
      );
    });

    it('não consegue apagar a política de isolamento', async () => {
      await expect(
        app.query('DROP POLICY unidade_isolamento_por_tenant ON unidade'),
      ).rejects.toThrow(/must be owner/);
    });

    it('não é superusuário nem tem BYPASSRLS', async () => {
      const { rows } = await app.query<{ rolbypassrls: boolean; rolsuper: boolean }>(
        'SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user',
      );

      expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
    });
  });

  describe('gymos_atualizar_identidade_do_tenant', () => {
    const atualizar = (nome: string) =>
      app.query<{ id: string; nome: string }>(
        "SELECT id, nome FROM gymos_atualizar_identidade_do_tenant($1, '#112233', NULL)",
        [nome],
      );
    const nomeDo = async (slug: string) => {
      const { rows } = await app.query<{ nome: string }>(
        'SELECT nome FROM gymos_tenant_por_slug($1)',
        [slug],
      );
      return rows[0]?.nome;
    };

    it('sem contexto lança erro e não altera nada', async () => {
      await expect(atualizar('Sem contexto')).rejects.toThrow(/app\.tenant_id não definido/);

      expect(await nomeDo(a.slug)).toBe(a.nome);
      expect(await nomeDo(b.slug)).toBe(b.nome);
    });

    it("com app.tenant_id = '' também lança erro", async () => {
      await app.query('BEGIN');
      try {
        await app.query("SELECT set_config('app.tenant_id', '', true)");
        await expect(atualizar('Vazio')).rejects.toThrow(/app\.tenant_id não definido/);
      } finally {
        await app.query('ROLLBACK');
      }
    });

    it('no contexto de A altera só A', async () => {
      const { rows } = await comTenant(app, a.id, () => atualizar('Novo nome de A'));

      expect(rows).toEqual([{ id: a.id, nome: 'Novo nome de A' }]);
      expect(await nomeDo(a.slug)).toBe('Novo nome de A');
      expect(await nomeDo(b.slug)).toBe(b.nome);
    });

    it('com UUID inexistente no contexto não altera ninguém e devolve zero linhas', async () => {
      const { rows } = await comTenant(app, randomUUID(), () => atualizar('Fantasma'));

      expect(rows).toEqual([]);
      expect(await nomeDo(b.slug)).toBe(b.nome);
    });
  });

  describe('gymos_tenant_da_referencia_externa', () => {
    const dono = async (provedor: string, idExterno: string) => {
      const { rows } = await app.query<{ id: string | null }>(
        'SELECT gymos_tenant_da_referencia_externa($1, $2) AS id',
        [provedor, idExterno],
      );
      return rows[0]?.id;
    };

    it('devolve o tenant dono da referência, mesmo sem contexto', async () => {
      expect(await dono('fake', 'ext-iso-b')).toBe(b.id);
    });

    it('devolve null para provedor ou id externo desconhecido', async () => {
      expect(await dono('fake', 'nao-existe')).toBeNull();
      expect(await dono('outro', 'ext-iso-b')).toBeNull();
    });
  });
});
