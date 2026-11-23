import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Tenant } from '../../domain/tenant';
import type { ClienteTransacional } from '../prisma/criar-cliente';

export interface EstadoDoContexto {
  tenant?: Tenant;
  /** Cliente da transação aberta com app.tenant_id (requisição ou runAsTenant). */
  cliente?: ClienteTransacional;
  /** Instante fixado pelo cabeçalho x-relogio (só fora de produção). */
  instanteFixo?: Date;
}

export class SemContextoDeTenantError extends Error {
  constructor() {
    super(
      'Acesso a dados fora de um contexto de tenant: use uma rota com tenant resolvido ou runAsTenant.',
    );
    this.name = 'SemContextoDeTenantError';
  }
}

/**
 * Contexto da requisição ou do job, em AsyncLocalStorage. Repositórios pegam aqui o cliente
 * transacional do tenant, nunca o cliente global.
 */
@Injectable()
export class ContextoDoTenant {
  private readonly armazenamento = new AsyncLocalStorage<EstadoDoContexto>();

  executar<T>(estado: EstadoDoContexto, fn: () => T): T {
    return this.armazenamento.run(estado, fn);
  }

  estado(): EstadoDoContexto | undefined {
    return this.armazenamento.getStore();
  }

  tenant(): Tenant {
    const tenant = this.estado()?.tenant;
    if (!tenant) {
      throw new SemContextoDeTenantError();
    }
    return tenant;
  }

  cliente(): ClienteTransacional {
    const cliente = this.estado()?.cliente;
    if (!cliente) {
      throw new SemContextoDeTenantError();
    }
    return cliente;
  }
}
