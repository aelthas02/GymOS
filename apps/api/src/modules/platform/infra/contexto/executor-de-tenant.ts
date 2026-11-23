import { Injectable } from '@nestjs/common';
import { RepositorioDeTenants } from '../../application/portas';
import type { Tenant } from '../../domain/tenant';
import { PrismaService } from '../prisma/prisma.service';
import { ContextoDoTenant } from './contexto-do-tenant';
import { transacaoDoTenant } from './transacao-do-tenant';

export class TenantObrigatorioError extends Error {
  constructor() {
    super('runAsTenant exige o tenantId: job sem tenant não executa.');
    this.name = 'TenantObrigatorioError';
  }
}

export class TenantDesconhecidoError extends Error {
  constructor(readonly tenantId: string) {
    super(`Tenant ${tenantId} não encontrado.`);
    this.name = 'TenantDesconhecidoError';
  }
}

export class TenantAninhadoError extends Error {
  constructor() {
    super('runAsTenant chamado dentro do contexto de outro tenant.');
    this.name = 'TenantAninhadoError';
  }
}

/**
 * Execução fora de requisição (workers, jobs, webhooks): abre a transação com app.tenant_id e o
 * contexto do tenant. Sem tenantId falha fechado, sem executar a função.
 */
@Injectable()
export class ExecutorDeTenant {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexto: ContextoDoTenant,
    private readonly tenants: RepositorioDeTenants,
  ) {}

  async runAsTenant<T>(tenantId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
    if (!tenantId) {
      throw new TenantObrigatorioError();
    }
    const estado = this.contexto.estado();
    const atual = estado?.tenant;
    if (atual) {
      if (atual.id !== tenantId) {
        throw new TenantAninhadoError();
      }
      // Tenant resolvido pela requisição, mas ainda sem transação (guards rodam antes do
      // interceptor): abre a transação do próprio tenant.
      return estado.cliente ? fn() : this.executarNaTransacao(atual, fn);
    }
    const tenant = await this.tenants.porId(tenantId);
    if (!tenant) {
      throw new TenantDesconhecidoError(tenantId);
    }
    return this.executarNaTransacao(tenant, fn);
  }

  /**
   * Para jobs "para todos os tenants": um runAsTenant por tenant, em sequência. A falha de um tenant
   * não impede os outros; no fim, as falhas sobem juntas num AggregateError.
   */
  async paraCadaTenant<T>(fn: (tenant: Pick<Tenant, 'id' | 'slug'>) => Promise<T>): Promise<T[]> {
    const resultados: T[] = [];
    const falhas: unknown[] = [];
    for (const tenant of await this.tenants.listar()) {
      try {
        resultados.push(await this.runAsTenant(tenant.id, () => fn(tenant)));
      } catch (error) {
        falhas.push(error);
      }
    }
    if (falhas.length > 0) {
      throw new AggregateError(falhas, `${falhas.length} tenant(s) falharam.`);
    }
    return resultados;
  }

  /** Usado pela requisição (tenant já resolvido) e por runAsTenant. */
  executarNaTransacao<T>(tenant: Tenant, fn: () => Promise<T>): Promise<T> {
    return transacaoDoTenant(this.prisma, tenant.id, (cliente) =>
      this.contexto.executar({ ...this.contexto.estado(), tenant, cliente }, fn),
    );
  }
}
