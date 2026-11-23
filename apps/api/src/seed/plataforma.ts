import type { INestApplicationContext } from '@nestjs/common';
import { RepositorioDeTenants } from '../modules/platform/application/portas';
import { ContextoDoTenant } from '../modules/platform/infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../modules/platform/infra/contexto/executor-de-tenant';

/**
 * Formato provisório de um módulo de seed. O runner (`pnpm seed`) e o contrato definitivo são do T35,
 * que ordena os módulos por `dependeDe` e pode ajustar esta interface.
 */
export interface ModuloDeSeed {
  nome: string;
  dependeDe: readonly string[];
  executar(app: INestApplicationContext): Promise<void>;
}

export const ACADEMIA_RITMO = {
  slug: 'ritmo',
  nome: 'Academia Ritmo',
  corDestaque: '#22C98A',
  unidade: 'Unidade Centro',
} as const;

/** Tenant Ritmo e a Unidade Centro das telas. Idempotente: rodar de novo não duplica. */
export const seedDaPlataforma: ModuloDeSeed = {
  nome: 'plataforma',
  dependeDe: [],
  async executar(app) {
    const tenants = app.get(RepositorioDeTenants);
    const existente = await tenants.porSlug(ACADEMIA_RITMO.slug);
    if (!existente) {
      await tenants.criarComUnidade({
        slug: ACADEMIA_RITMO.slug,
        nome: ACADEMIA_RITMO.nome,
        corDestaque: ACADEMIA_RITMO.corDestaque,
        nomeDaUnidade: ACADEMIA_RITMO.unidade,
      });
      return;
    }
    const contexto = app.get(ContextoDoTenant);
    await app.get(ExecutorDeTenant).runAsTenant(existente.id, async () => {
      const unidades = contexto.cliente().unidade;
      if (!(await unidades.findFirst({ where: { nome: ACADEMIA_RITMO.unidade } }))) {
        await unidades.create({ data: { tenantId: existente.id, nome: ACADEMIA_RITMO.unidade } });
      }
    });
  },
};
