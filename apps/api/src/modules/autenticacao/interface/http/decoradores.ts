import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { ReivindicacoesDoAcesso } from '../../application/portas';
import type { Publico } from '../../domain/credenciais';
import type { ModuloExtra, Permissao } from '../../domain/permissoes';

export const PERMISSAO_EXIGIDA = 'gymos:permissao';
export const MODULO_EXIGIDO = 'gymos:modulo';
export const SESSAO_EXIGIDA = 'gymos:sessao';

/** Exige sessão; com `publico`, só a da equipe ou só a do aluno. */
export const Autenticado = (publico?: Publico): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(SESSAO_EXIGIDA, publico ?? 'qualquer'),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Sem sessão válida.' }),
  );

/** Exige sessão da equipe com a permissão `modulo:acao`; sem ela, 403 e o gancho aoNegarPermissao. */
export const RequirePermission = (permissao: Permissao): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(PERMISSAO_EXIGIDA, permissao),
    Autenticado('staff'),
    ApiForbiddenResponse({ description: `Exige a permissão ${permissao}.` }),
  );

/** Rota de módulo extra: com o módulo desligado no tenant, responde 404 (ADR-006). */
export const RequireModule = (modulo: ModuloExtra): MethodDecorator & ClassDecorator =>
  SetMetadata(MODULO_EXIGIDO, modulo);

export const SESSAO_DA_REQUISICAO = Symbol('SessaoDaRequisicao');

export interface RequisicaoComSessao {
  [SESSAO_DA_REQUISICAO]?: ReivindicacoesDoAcesso;
}

/** A sessão validada pelo AcessoGuard (só em rotas com `@Autenticado` ou `@RequirePermission`). */
export const SessaoAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): ReivindicacoesDoAcesso => {
    const sessao = contexto.switchToHttp().getRequest<RequisicaoComSessao>()[SESSAO_DA_REQUISICAO];
    if (!sessao) {
      throw new Error('@SessaoAtual() exige @Autenticado() ou @RequirePermission() na rota.');
    }
    return sessao;
  },
);
