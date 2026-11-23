import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, type Observable } from 'rxjs';
import { ContextoDoTenant } from '../../infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../../infra/contexto/executor-de-tenant';

/**
 * Cada requisição com tenant resolvido roda numa transação com app.tenant_id: erro desfaz tudo, e a
 * resposta só sai depois do commit. `next.handle()` é chamado dentro do contexto, porque o Nest
 * amarra o handler ao contexto assíncrono de onde ele é chamado.
 */
@Injectable()
export class TransacaoPorRequisicaoInterceptor implements NestInterceptor {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly executor: ExecutorDeTenant,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const tenant = this.contexto.estado()?.tenant;
    if (!tenant || context.getType() !== 'http') {
      return next.handle();
    }
    return from(
      this.executor.executarNaTransacao(tenant, () =>
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }
}
