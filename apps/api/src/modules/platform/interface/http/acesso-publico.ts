import { SetMetadata } from '@nestjs/common';

export const ACESSO_PUBLICO = 'gymos:acesso-publico';

/**
 * Rota aberta sem sessão (login, identidade pública, webhooks e operação com guard próprio). Toda
 * rota /api declara o acesso: `@Publica()`, `@Autenticado()` ou `@RequirePermission(...)` (T12).
 */
export const Publica = (): MethodDecorator & ClassDecorator => SetMetadata(ACESSO_PUBLICO, true);
