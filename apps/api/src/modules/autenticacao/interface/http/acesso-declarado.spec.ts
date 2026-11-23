import { ModulesContainer } from '@nestjs/core';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { createTestApp, type TestApp } from '../../../../testing/test-app';
import { HealthController } from '../../../../observabilidade/health/health.controller';
import { MetricsController } from '../../../../observabilidade/metrics/metrics.controller';
import { ACESSO_PUBLICO } from '../../../platform/interface/http/acesso-publico';
import { SESSAO_EXIGIDA } from './decoradores';

// Fora do prefixo /api (sondas e métricas), sem sessão por natureza.
const FORA_DA_API = new Set<unknown>([HealthController, MetricsController]);

// O AcessoGuard só age sobre o que está declarado: uma rota sem declaração ficaria aberta. Este teste
// garante que toda rota da API diz se é pública, exige sessão ou exige permissão.
describe('acesso declarado em toda rota da API', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(() => app.close());

  it('cada handler tem @Publica, @Autenticado ou @RequirePermission', () => {
    const semDeclaracao: string[] = [];
    let rotas = 0;
    for (const modulo of app.nest.get(ModulesContainer).values()) {
      for (const { metatype } of modulo.controllers.values()) {
        if (!metatype || FORA_DA_API.has(metatype)) {
          continue;
        }
        const prototipo = metatype.prototype as Record<string, unknown>;
        for (const nome of Object.getOwnPropertyNames(prototipo)) {
          const handler = prototipo[nome];
          if (
            typeof handler !== 'function' ||
            Reflect.getMetadata(METHOD_METADATA, handler) === undefined
          ) {
            continue;
          }
          rotas++;
          const declarado = [ACESSO_PUBLICO, SESSAO_EXIGIDA].some(
            (chave) =>
              Reflect.getMetadata(chave, handler) !== undefined ||
              Reflect.getMetadata(chave, metatype) !== undefined,
          );
          if (!declarado) {
            semDeclaracao.push(
              `${metatype.name}.${nome} (${String(Reflect.getMetadata(PATH_METADATA, handler))})`,
            );
          }
        }
      }
    }

    expect(rotas).toBeGreaterThan(10);
    expect(semDeclaracao).toEqual([]);
  });
});
