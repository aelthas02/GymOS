import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Consentimentos } from '../../application/protecao-de-dados';
import { criarAppDeTeste } from '../../testing/app-de-teste';
import { usarBancoDeTeste } from '../../testing/banco-de-teste';
import { criarTenant, type TenantCriado } from '../../testing/fabricas';
import { ContextoDoTenant } from '../contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../contexto/executor-de-tenant';

describe('consentimento por finalidade', () => {
  const banco = usarBancoDeTeste();
  let app: INestApplication;
  let academia: TenantCriado;

  /** runAsTenant com o relógio parado no instante dado (o mesmo mecanismo do x-relogio). */
  const em = <T>(instante: string, fn: (consentimentos: Consentimentos) => Promise<T>): Promise<T> =>
    app
      .get(ContextoDoTenant)
      .executar({ instanteFixo: new Date(instante) }, () =>
        app.get(ExecutorDeTenant).runAsTenant(academia.id, () => fn(app.get(Consentimentos))),
      );

  beforeAll(async () => {
    app = await criarAppDeTeste(banco);
    academia = await criarTenant(await banco.conectarComoApp());
  });

  it('aluno sem consentimento de marketing continua elegível para mensagem transacional', async () => {
    const alunoId = randomUUID();

    await em('2026-11-23T12:00:00Z', async (consentimentos) => {
      expect(await consentimentos.elegivel(alunoId, 'marketing')).toBe(false);
      expect(await consentimentos.elegivel(alunoId, 'transacional')).toBe(true);
    });
  });

  it('revogar marketing registra a data e a origem e remove a elegibilidade na hora', async () => {
    const alunoId = randomUUID();
    await em('2026-11-20T09:00:00Z', (consentimentos) =>
      consentimentos.registrar({
        alunoId,
        finalidade: 'marketing',
        decisao: 'aceite',
        origem: 'painel',
      }),
    );

    await em('2026-11-23T15:30:00Z', async (consentimentos) => {
      expect(await consentimentos.elegivel(alunoId, 'marketing')).toBe(true);

      await consentimentos.registrar({
        alunoId,
        finalidade: 'marketing',
        decisao: 'revogacao',
        origem: 'app-do-aluno',
      });

      expect(await consentimentos.elegivel(alunoId, 'marketing')).toBe(false);
    });

    const historico = await em('2026-11-23T16:00:00Z', (consentimentos) =>
      consentimentos.historico(alunoId),
    );
    expect(historico).toEqual([
      {
        finalidade: 'marketing',
        decisao: 'aceite',
        origem: 'painel',
        registradoEm: new Date('2026-11-20T09:00:00Z'),
      },
      {
        finalidade: 'marketing',
        decisao: 'revogacao',
        origem: 'app-do-aluno',
        registradoEm: new Date('2026-11-23T15:30:00Z'),
      },
    ]);
  });
});
