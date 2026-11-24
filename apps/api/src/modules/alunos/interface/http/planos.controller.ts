import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ReivindicacoesDoAcesso } from '../../../autenticacao/application/portas';
import { RequirePermission, SessaoAtual } from '../../../autenticacao/interface/http/decoradores';
import { ConfiguracaoDosContratos } from '../../application/contratos';
import { Planos } from '../../application/planos';
import type { DadosDoPlano } from '../../domain/plano';
import {
  ConfiguracaoDeContratoDto,
  ConsultaDePlanosDto,
  DadosDoPlanoDto,
  PlanoDto,
  PreviaDoPlanoConsultaDto,
  PreviaDoPlanoDto,
} from './dto';
import { ErrosDosAlunosFilter } from './erros.filter';
import { planoDto } from './mapeamento';

const uuid = new ParseUUIDPipe({ version: '4' });

function dadosDoPlano(corpo: DadosDoPlanoDto): DadosDoPlano {
  return { ...corpo, acessosPorSemana: corpo.acessosPorSemana ?? null };
}

@ApiTags('planos')
@UseFilters(ErrosDosAlunosFilter)
@Controller('planos')
export class PlanosController {
  constructor(private readonly planos: Planos) {}

  @Get()
  @RequirePermission('planos:ver')
  @ApiOperation({
    operationId: 'listarPlanos',
    summary: 'Planos da academia, com os alunos ativos de cada um.',
  })
  @ApiOkResponse({ type: [PlanoDto] })
  async listar(@Query() consulta: ConsultaDePlanosDto): Promise<PlanoDto[]> {
    return (await this.planos.listar(consulta.busca)).map(planoDto);
  }

  @Get('previa')
  @RequirePermission('planos:ver')
  @ApiOperation({
    operationId: 'previaDoPlano',
    summary: 'Valor da parcela (rateio, resto na última) e texto explicativo, sem gravar.',
  })
  @ApiOkResponse({ type: PreviaDoPlanoDto })
  @ApiBadRequestResponse({ description: 'Parcelas acima da duração ou valores inválidos.' })
  previa(@Query() consulta: PreviaDoPlanoConsultaDto): PreviaDoPlanoDto {
    return this.planos.previa({
      valorTotalCentavos: Number(consulta.valorTotalCentavos),
      duracaoMeses: Number(consulta.duracaoMeses),
      parcelas: Number(consulta.parcelas),
    });
  }

  @Get(':id')
  @RequirePermission('planos:ver')
  @ApiOperation({ operationId: 'obterPlano', summary: 'Um plano.' })
  @ApiOkResponse({ type: PlanoDto })
  @ApiNotFoundResponse({ description: 'Plano não encontrado.' })
  async obter(@Param('id', uuid) id: string): Promise<PlanoDto> {
    return planoDto(await this.planos.obter(id));
  }

  @Post()
  @RequirePermission('planos:criar')
  @ApiOperation({ operationId: 'criarPlano', summary: 'Cria um plano (parcelas ≤ duração).' })
  @ApiCreatedResponse({ type: PlanoDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos ou parcelas acima da duração.' })
  async criar(@Body() corpo: DadosDoPlanoDto): Promise<PlanoDto> {
    return planoDto(await this.planos.criar(dadosDoPlano(corpo)));
  }

  @Put(':id')
  @RequirePermission('planos:editar')
  @ApiOperation({
    operationId: 'editarPlano',
    summary: 'Edita o plano (inativar é `ativo: false`); mudar o valor grava auditoria sensível.',
  })
  @ApiOkResponse({ type: PlanoDto })
  @ApiNotFoundResponse({ description: 'Plano não encontrado.' })
  async editar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: DadosDoPlanoDto,
  ): Promise<PlanoDto> {
    return planoDto(
      await this.planos.editar({ usuarioId: sessao.sujeitoId }, id, dadosDoPlano(corpo)),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('planos:excluir')
  @ApiOperation({
    operationId: 'excluirPlano',
    summary: 'Exclui o plano; com alunos ativos, recusa.',
  })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'O plano tem alunos ativos: inative em vez de excluir.' })
  async excluir(@Param('id', uuid) id: string): Promise<void> {
    await this.planos.excluir(id);
  }
}

@ApiTags('configuracoes')
@UseFilters(ErrosDosAlunosFilter)
@Controller('configuracoes/contratos')
export class ConfiguracaoDeContratosController {
  constructor(private readonly configuracao: ConfiguracaoDosContratos) {}

  @Get()
  @RequirePermission('configuracoes.contratos:ver')
  @ApiOperation({
    operationId: 'obterConfiguracaoDeContratos',
    summary: 'Tolerância de atraso, reativação sem nova adesão e trancamento máximo.',
  })
  @ApiOkResponse({ type: ConfiguracaoDeContratoDto })
  obter(): Promise<ConfiguracaoDeContratoDto> {
    return this.configuracao.obter();
  }

  @Put()
  @RequirePermission('configuracoes.contratos:editar')
  @ApiOperation({
    operationId: 'salvarConfiguracaoDeContratos',
    summary: 'Salva o bloco "Contratos e atraso" (auditoria sensível).',
  })
  @ApiOkResponse({ type: ConfiguracaoDeContratoDto })
  salvar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: ConfiguracaoDeContratoDto,
  ): Promise<ConfiguracaoDeContratoDto> {
    return this.configuracao.salvar({ usuarioId: sessao.sujeitoId }, corpo);
  }
}
