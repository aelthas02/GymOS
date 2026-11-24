import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * O ingress público sempre acrescenta X-Forwarded-*; a coleta interna (Prometheus na rede privada)
 * fala direto com a API. Quem chegou por proxy recebe 404, como se a rota não existisse.
 */
@Injectable()
export class SomenteRedeInternaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { headers } = context.switchToHttp().getRequest<Request>();
    if (headers['x-forwarded-for'] || headers['x-forwarded-host']) {
      throw new NotFoundException();
    }
    return true;
  }
}
