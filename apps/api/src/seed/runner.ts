import type { INestApplicationContext } from '@nestjs/common';
import { RepositorioDeTenants } from '../modules/platform/application/portas';
import { ExecutorDeTenant } from '../modules/platform/infra/contexto/executor-de-tenant';
import { ACADEMIA_RITMO } from './plataforma';
import type { ContextoDoSeed, ModuloDeSeed } from './modulo-de-seed';
import { ordenarModulosDeSeed } from './ordenar';

export interface OpcoesDoSeed {
  /** Recebe cada passo ("autenticacao"); o CLI imprime. */
  aoExecutar?(nome: string): void;
}

/** Contexto entregue a cada módulo; os specs dos módulos o usam para chamar `executar` direto. */
export function contextoDoSeed(app: INestApplicationContext): ContextoDoSeed {
  return {
    async noTenant(corpo) {
      const tenant = await app.get(RepositorioDeTenants).porSlug(ACADEMIA_RITMO.slug);
      if (!tenant) {
        throw new Error(
          `O tenant ${ACADEMIA_RITMO.slug} não existe: o módulo "plataforma" precisa rodar antes.`,
        );
      }
      return app.get(ExecutorDeTenant).runAsTenant(tenant.id, () => corpo(tenant.id));
    },
  };
}

/** Roda os módulos na ordem das dependências. Idempotente se cada módulo for. */
export async function executarSeed(
  app: INestApplicationContext,
  modulos: readonly ModuloDeSeed[],
  opcoes: OpcoesDoSeed = {},
): Promise<string[]> {
  const ordem = ordenarModulosDeSeed(modulos);
  const contexto = contextoDoSeed(app);
  for (const modulo of ordem) {
    opcoes.aoExecutar?.(modulo.nome);
    await modulo.executar(app, contexto);
  }
  return ordem.map((modulo) => modulo.nome);
}
