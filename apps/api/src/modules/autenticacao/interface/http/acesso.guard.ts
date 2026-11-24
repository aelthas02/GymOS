import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Relogio } from '../../../platform/domain/relogio';
import type { Tenant } from '../../../platform/domain/tenant';
import { ContextoDoTenant } from '../../../platform/infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../../../platform/infra/contexto/executor-de-tenant';
import { AutorizarPermissao, ModulosDoTenant } from '../../application/perfil';
import {
  AoNegarPermissao,
  EmissorDeTokens,
  type ReivindicacoesDoAcesso,
} from '../../application/portas';
import type { ModuloExtra, Permissao } from '../../domain/permissoes';
import {
  MODULO_EXIGIDO,
  PERMISSAO_EXIGIDA,
  type RequisicaoComSessao,
  SESSAO_DA_REQUISICAO,
  SESSAO_EXIGIDA,
} from './decoradores';

type Decisao =
  | { tipo: 'liberado'; sessao?: ReivindicacoesDoAcesso }
  | { tipo: 'modulo-desligado' }
  | { tipo: 'sem-sessao' }
  | { tipo: 'negado'; sessao: ReivindicacoesDoAcesso; permissao: Permissao };

/**
 * Guard global de `@RequireModule`, `@Autenticado` e `@RequirePermission`. Roda antes do
 * interceptor de transação, por isso abre a própria transação do tenant para ler o banco. A ordem
 * é: módulo desligado (404), sessão (401) e permissão (403, com o gancho aoNegarPermissao).
 */
@Injectable()
export class AcessoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly contexto: ContextoDoTenant,
    private readonly executor: ExecutorDeTenant,
    private readonly emissor: EmissorDeTokens,
    private readonly modulos: ModulosDoTenant,
    private readonly autorizar: AutorizarPermissao,
    private readonly aoNegar: AoNegarPermissao,
    private readonly relogio: Relogio,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const alvos = [context.getHandler(), context.getClass()];
    const modulo = this.reflector.getAllAndOverride<ModuloExtra | undefined>(MODULO_EXIGIDO, alvos);
    const permissao = this.reflector.getAllAndOverride<Permissao | undefined>(
      PERMISSAO_EXIGIDA,
      alvos,
    );
    const publico = this.reflector.getAllAndOverride<string | undefined>(SESSAO_EXIGIDA, alvos);
    if (context.getType() !== 'http' || (!modulo && !publico)) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request & RequisicaoComSessao>();
    const tenant = this.contexto.estado()?.tenant;
    if (!tenant) {
      throw new NotFoundException();
    }
    const decisao = await this.executor.executarNaTransacao(tenant, () =>
      this.decidir(tenant, req, { modulo, permissao, publico }),
    );
    switch (decisao.tipo) {
      case 'modulo-desligado':
        throw new NotFoundException();
      case 'sem-sessao':
        throw new UnauthorizedException();
      case 'negado':
        // Fora da transação da leitura: o T13b grava a auditoria na transação dele.
        await this.aoNegar.registrar({
          tenantId: tenant.id,
          usuarioId: decisao.sessao.sujeitoId,
          permissao: decisao.permissao,
          rota: `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`,
        });
        throw new ForbiddenException();
      case 'liberado':
        req[SESSAO_DA_REQUISICAO] = decisao.sessao;
        return true;
    }
  }

  private async decidir(
    tenant: Tenant,
    req: Request,
    exige: { modulo?: ModuloExtra; permissao?: Permissao; publico?: string },
  ): Promise<Decisao> {
    if (exige.modulo && !(await this.modulos.ativo(tenant, exige.modulo))) {
      return { tipo: 'modulo-desligado' };
    }
    if (!exige.publico) {
      return { tipo: 'liberado' };
    }
    const sessao = this.sessaoDoCabecalho(req, tenant);
    if (!sessao || (exige.publico !== 'qualquer' && sessao.publico !== exige.publico)) {
      return { tipo: 'sem-sessao' };
    }
    if (!exige.permissao) {
      return { tipo: 'liberado', sessao };
    }
    const autorizacao = await this.autorizar.executar(sessao, exige.permissao);
    if (autorizacao === 'sem-sessao') {
      return { tipo: 'sem-sessao' };
    }
    return autorizacao === 'permitido'
      ? { tipo: 'liberado', sessao }
      : { tipo: 'negado', sessao, permissao: exige.permissao };
  }

  /** Bearer válido e do tenant do Host: token de outra academia não vale aqui. */
  private sessaoDoCabecalho(req: Request, tenant: Tenant): ReivindicacoesDoAcesso | null {
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }
    const sessao = this.emissor.verificar(token, this.relogio.agora());
    return sessao?.tenantId === tenant.id ? sessao : null;
  }
}
