import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExcludeController,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RepositorioDeTenants } from '../../../platform/application/portas';
import { ContextoDoTenant } from '../../../platform/infra/contexto/contexto-do-tenant';
import { ExecutorDeTenant } from '../../../platform/infra/contexto/executor-de-tenant';
import { Publica } from '../../../platform/interface/http/acesso-publico';
import { ChaveDeOperacaoGuard } from '../../../platform/interface/http/interno.controller';
import { ConvidarParaEquipe } from '../../application/convites';
import { ObterPerfil } from '../../application/perfil';
import { RepositorioDeModulos, type ReivindicacoesDoAcesso } from '../../application/portas';
import { ehModuloExtra } from '../../domain/permissoes';
import { Autenticado, RequirePermission, SessaoAtual } from './decoradores';
import { ConviteCriadoDto, ConvidarDto, PerfilDto, SobrescreverModuloDto } from './dto';

@ApiTags('autenticacao')
@Controller('me')
export class PerfilController {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly obterPerfil: ObterPerfil,
  ) {}

  @Get()
  @Autenticado()
  @ApiOperation({
    operationId: 'obterPerfil',
    summary: 'Quem está logado, permissões e módulos extras ativos (appPermission, menu lateral).',
  })
  @ApiOkResponse({ type: PerfilDto })
  async obter(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<PerfilDto> {
    const perfil = await this.obterPerfil.executar(this.contexto.tenant(), sessao);
    if (!perfil) {
      throw new UnauthorizedException();
    }
    return perfil;
  }
}

@ApiTags('equipe')
@Controller('equipe/convites')
export class ConvitesController {
  constructor(
    private readonly contexto: ContextoDoTenant,
    private readonly convidar: ConvidarParaEquipe,
  ) {}

  @Post()
  @RequirePermission('equipe:criar')
  @ApiOperation({
    operationId: 'convidarParaEquipe',
    summary: 'Convida por e-mail; o link cria a senha e vale por 7 dias.',
  })
  @ApiCreatedResponse({ type: ConviteCriadoDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos ou tipo de acesso inexistente.' })
  @ApiConflictResponse({ description: 'Já existe um usuário com este e-mail.' })
  async criar(@Body() corpo: ConvidarDto): Promise<ConviteCriadoDto> {
    const resultado = await this.convidar.executar(this.contexto.tenant(), corpo);
    switch (resultado.tipo) {
      case 'tipo-inexistente':
        throw new BadRequestException('Tipo de acesso não encontrado.');
      case 'email-em-uso':
        throw new ConflictException('Já existe um usuário com este e-mail.');
      case 'ok':
        return { id: resultado.id, expiraEm: resultado.expiraEm.toISOString() };
    }
  }
}

/** Operação da plataforma: sobrescrita manual de um módulo extra, por cima do plano contratado. */
@ApiExcludeController()
@Publica()
@UseGuards(ChaveDeOperacaoGuard)
@Controller('interno/academias/:slug/modulos')
export class ModulosInternoController {
  constructor(
    private readonly tenants: RepositorioDeTenants,
    private readonly executor: ExecutorDeTenant,
    private readonly modulos: RepositorioDeModulos,
  ) {}

  @Put(':modulo')
  async sobrescrever(
    @Param('slug') slug: string,
    @Param('modulo') modulo: string,
    @Body() corpo: SobrescreverModuloDto,
  ): Promise<{ modulo: string; ativo: boolean | null }> {
    const tenant = await this.tenants.porSlug(slug);
    if (!tenant || !ehModuloExtra(modulo)) {
      throw new NotFoundException();
    }
    await this.executor.runAsTenant(tenant.id, () =>
      this.modulos.sobrescrever(modulo, corpo.ativo),
    );
    return { modulo, ativo: corpo.ativo };
  }
}
