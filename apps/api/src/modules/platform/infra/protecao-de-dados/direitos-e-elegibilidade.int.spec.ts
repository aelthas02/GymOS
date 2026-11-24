import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DireitosDoTitular } from '../../application/direitos-do-titular';
import { Consentimentos } from '../../application/protecao-de-dados';
import { ConsentimentoInvalidoError } from '../../domain/consentimento';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';

describe('consentimento em lote e direitos do titular', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let academia: TenantCriado;
  let outra: TenantCriado;

  const como = <T>(tenant: TenantCriado, fn: () => Promise<T>): Promise<T> =>
    app.get(ExecutorDeTenant).runAsTenant(tenant.id, fn);
  const consentimentos = () => app.get(Consentimentos);

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    const conexao = await banco.conectarComoApp();
    academia = await criarTenant(conexao);
    outra = await criarTenant(conexao);
  });

  it('registrar valida: transacional, finalidade desconhecida e origem vazia não gravam', async () => {
    const alunoId = randomUUID();
    const base = { alunoId, decisao: 'aceite', origem: 'painel' } as const;

    await como(academia, async () => {
      await expect(
        consentimentos().registrar({ ...base, finalidade: 'transacional' }),
      ).rejects.toThrow(ConsentimentoInvalidoError);
      await expect(
        consentimentos().registrar({ ...base, finalidade: 'x' as 'marketing' }),
      ).rejects.toThrow(/desconhecida/);
      await expect(
        consentimentos().registrar({ ...base, finalidade: 'marketing', origem: ' ' }),
      ).rejects.toThrow(/origem/);
      expect(await consentimentos().historico(alunoId)).toEqual([]);
    });
  });

  it('elegiveis: transacional devolve todos; lista vazia devolve vazio', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];

    await como(academia, async () => {
      expect(await consentimentos().elegiveis(ids, 'transacional')).toEqual(ids);
      expect(await consentimentos().elegiveis([], 'marketing')).toEqual([]);
      expect(await consentimentos().elegiveis([], 'transacional')).toEqual([]);
    });
  });

  it('elegiveis: mistura de aceite, revogação, reaceite e sem decisão, preservando a ordem da lista', async () => {
    const [aceitou, revogou, reaceitou, semDecisao, soOutraFinalidade] = Array.from(
      { length: 5 },
      () => randomUUID(),
    ) as [string, string, string, string, string];
    const decidir = (alunoId: string, decisao: 'aceite' | 'revogacao', finalidade = 'marketing') =>
      consentimentos().registrar({
        alunoId,
        finalidade: finalidade as 'marketing',
        decisao,
        origem: 'painel',
      });

    await como(academia, async () => {
      await decidir(aceitou, 'aceite');
      await decidir(revogou, 'aceite');
      await decidir(revogou, 'revogacao');
      await decidir(reaceitou, 'aceite');
      await decidir(reaceitou, 'revogacao');
      await decidir(reaceitou, 'aceite');
      await decidir(soOutraFinalidade, 'aceite', 'biometria');

      const lista = [semDecisao, reaceitou, revogou, aceitou, soOutraFinalidade];
      expect(await consentimentos().elegiveis(lista, 'marketing')).toEqual([reaceitou, aceitou]);
      expect(await consentimentos().elegiveis(lista, 'biometria')).toEqual([soOutraFinalidade]);
      expect(await consentimentos().elegivel(revogou, 'marketing')).toBe(false);
      expect(await consentimentos().elegivel(aceitou, 'marketing')).toBe(true);
    });
  });

  it('consentimento de um tenant não vale em outro', async () => {
    const alunoId = randomUUID();
    await como(academia, () =>
      consentimentos().registrar({
        alunoId,
        finalidade: 'marketing',
        decisao: 'aceite',
        origem: 'painel',
      }),
    );

    await como(outra, async () => {
      expect(await consentimentos().elegivel(alunoId, 'marketing')).toBe(false);
      expect(await consentimentos().historico(alunoId)).toEqual([]);
    });
  });

  it('DireitosDoTitular exporta e exclui o histórico de consentimento do aluno, só dele e só no tenant', async () => {
    const alunoId = randomUUID();
    const outroAluno = randomUUID();
    const registrar = (aluno: string, decisao: 'aceite' | 'revogacao') =>
      consentimentos().registrar({
        alunoId: aluno,
        finalidade: 'marketing',
        decisao,
        origem: 'app-do-aluno',
      });
    await como(academia, async () => {
      await registrar(alunoId, 'aceite');
      await registrar(alunoId, 'revogacao');
      await registrar(outroAluno, 'aceite');
    });
    await como(outra, () => registrar(alunoId, 'aceite'));

    const exportacao = await como(academia, () => app.get(DireitosDoTitular).exportar(alunoId));
    expect(exportacao.alunoId).toBe(alunoId);
    expect(exportacao.dominios['consentimentos']).toEqual([
      expect.objectContaining({
        finalidade: 'marketing',
        decisao: 'aceite',
        origem: 'app-do-aluno',
      }),
      expect.objectContaining({ finalidade: 'marketing', decisao: 'revogacao' }),
    ]);

    const relatorio = await como(academia, () => app.get(DireitosDoTitular).excluir(alunoId));
    expect(relatorio.dominios).toEqual([
      { dominio: 'consentimentos', modo: 'excluir', registros: 2 },
    ]);

    await como(academia, async () => {
      expect(await consentimentos().historico(alunoId)).toEqual([]);
      expect(await consentimentos().historico(outroAluno)).toHaveLength(1);
    });
    await como(outra, async () => {
      expect(await consentimentos().historico(alunoId)).toHaveLength(1);
    });

    const segunda = await como(academia, () => app.get(DireitosDoTitular).excluir(alunoId));
    expect(segunda.dominios[0]?.registros).toBe(0);
  });
});
