import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ContextoDoTenant } from '../../../platform/infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../../../platform/infra/contexto/executor-de-tenant';
import { Pareamento } from '../../application/pareamento';
import type { AgenteDaCatraca } from '../../application/portas';
import { CredencialDoAgenteInvalidaError } from '../../application/erros';

const AGENTE_DA_REQUISICAO = Symbol('AgenteDaRequisicao');

interface RequisicaoComAgente {
  [AGENTE_DA_REQUISICAO]?: AgenteDaCatraca;
}

/**
 * Autentica o agente da catraca pela credencial própria (`Authorization: Bearer ga1.<id>.<segredo>`),
 * no tenant do Host. As rotas do agente são `@Publica()` para o guard global de sessão e usam este
 * guard no lugar. Roda antes do interceptor de transação, por isso abre a própria transação do tenant.
 * Credencial ausente, errada, de outra academia ou revogada responde 401.
 */
@Injectable()
export class AgenteGuard implements CanActivate {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly executor: ExecutorDeTenant,
    private readonly pareamento: Pareamento,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & RequisicaoComAgente>();
    const tenant = this.contexto.estado()?.tenant;
    if (!tenant) {
      throw new NotFoundException();
    }
    const [esquema, credencial] = (req.headers.authorization ?? '').split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !credencial) {
      throw new CredencialDoAgenteInvalidaError();
    }
    req[AGENTE_DA_REQUISICAO] = await this.executor.executarNaTransacao(tenant, () =>
      this.pareamento.autenticar(credencial),
    );
    return true;
  }
}

/** O agente autenticado pelo `AgenteGuard`. */
export const AgenteAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): AgenteDaCatraca => {
    const agente = contexto.switchToHttp().getRequest<RequisicaoComAgente>()[AGENTE_DA_REQUISICAO];
    if (!agente) {
      throw new Error('@AgenteAtual() exige o AgenteGuard na rota.');
    }
    return agente;
  },
);
