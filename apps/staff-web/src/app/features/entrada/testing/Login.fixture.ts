import type { Schemas } from '@gymos/api-contracts';
import type { FixtureDeTela } from '../../../../../../e2e/src/fixture-de-tela';

/** Identidade que `Login.html` mostra: "Academia Ritmo" com o destaque padrão. */
const tenant: Schemas['IdentidadeDoTenantDto'] = {
  nome: 'Academia Ritmo',
  corDestaque: '#22C98A',
  logotipoUrl: null,
};

/** Campos preenchidos em `Login.html` (o `value` dos dois inputs). */
export const credencialDoLogin = {
  email: 'carla@academiaritmo.com',
  senha: '••••••••••',
} as const;

/**
 * Fixture de `/entrar` (ADR-019): a regressão visual roda com a API interceptada; o único acesso à
 * API da tela é a identidade da academia. Relógio padrão (19/11/2026 09:00).
 */
export default {
  respostas: [{ caminho: '/public/tenant', corpo: tenant }],
} satisfies FixtureDeTela;
