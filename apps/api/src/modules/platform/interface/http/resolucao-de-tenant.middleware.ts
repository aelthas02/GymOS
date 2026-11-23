import { Inject, Injectable, type NestMiddleware, NotFoundException } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { RepositorioDeTenants } from '../../application/portas';
import { slugDoHost } from '../../domain/tenant';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
  permiteRecursosDeDesenvolvimento,
} from '../../infra/configuracao';
import { ContextoDoTenant } from '../../infra/contexto/contexto-do-tenant';
import { cabecalho } from './cabecalho';

export const CABECALHO_DO_TENANT = 'x-tenant';
export const ACADEMIA_NAO_ENCONTRADA = 'Academia não encontrada.';

/**
 * Resolve o tenant pelo subdomínio do Host (em dev e teste, também pelo x-tenant) antes de tocar no
 * banco com contexto: tenant desconhecido responde 404 sem abrir transação (ADR-004).
 */
@Injectable()
export class ResolucaoDeTenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenants: RepositorioDeTenants,
    private readonly contexto: ContextoDoTenant,
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly config: ConfiguracaoDaPlataforma,
  ) {}

  async use(req: IncomingMessage, _res: unknown, next: () => void): Promise<void> {
    const estado = this.contexto.estado();
    if (!estado) {
      throw new Error('ContextoDaRequisicaoMiddleware precisa rodar antes da resolução do tenant.');
    }
    const slug = this.slugDaRequisicao(req);
    const tenant = slug ? await this.tenants.porSlug(slug) : null;
    if (!tenant) {
      throw new NotFoundException(ACADEMIA_NAO_ENCONTRADA);
    }
    estado.tenant = tenant;
    next();
  }

  private slugDaRequisicao(req: IncomingMessage): string | null {
    const doCabecalho = cabecalho(req, CABECALHO_DO_TENANT)?.trim().toLowerCase();
    if (doCabecalho && permiteRecursosDeDesenvolvimento(this.config)) {
      return doCabecalho;
    }
    return slugDoHost(cabecalho(req, 'host'), this.config.dominioBase);
  }
}
