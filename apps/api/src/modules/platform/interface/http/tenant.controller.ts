import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AtualizarIdentidadeDoTenant } from '../../application/casos-de-uso';
import type { Tenant } from '../../domain/tenant';
import { ContextoDoTenant } from '../../infra/contexto/contexto-do-tenant';
import { IdentidadeDoTenantDto } from './dto/identidade.dto';
import { ACADEMIA_NAO_ENCONTRADA } from './resolucao-de-tenant.middleware';

function identidade(tenant: Tenant): IdentidadeDoTenantDto {
  return { nome: tenant.nome, corDestaque: tenant.corDestaque, logotipoUrl: tenant.logotipoUrl };
}

@ApiTags('tenant')
@ApiNotFoundResponse({ description: ACADEMIA_NAO_ENCONTRADA })
@Controller()
export class TenantController {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly atualizarIdentidade: AtualizarIdentidadeDoTenant,
  ) {}

  @Get('public/tenant')
  @ApiOperation({
    operationId: 'obterTenantPublico',
    summary: 'Identidade da academia do subdomínio, antes do login (Entrar, manifesto do PWA).',
  })
  @ApiOkResponse({ type: IdentidadeDoTenantDto })
  obterPublico(): IdentidadeDoTenantDto {
    return identidade(this.contexto.tenant());
  }

  @Put('tenant/identidade')
  @ApiOperation({
    operationId: 'atualizarIdentidadeDoTenant',
    summary: 'Nome, cor de destaque e logotipo (Primeiros passos e Configurações).',
  })
  @ApiOkResponse({ type: IdentidadeDoTenantDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos.' })
  async atualizar(@Body() corpo: IdentidadeDoTenantDto): Promise<IdentidadeDoTenantDto> {
    return identidade(
      await this.atualizarIdentidade.executar({
        nome: corpo.nome,
        corDestaque: corpo.corDestaque,
        logotipoUrl: corpo.logotipoUrl,
      }),
    );
  }
}
