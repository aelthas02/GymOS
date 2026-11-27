import { Body, Controller, Get, Param, Post, Query, UseFilters } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { ReivindicacoesDoAcesso } from '../../../autenticacao/application/portas';
import { RequirePermission, SessaoAtual } from '../../../autenticacao/interface/http/decoradores';
import { FiltroInvalidoError } from '../../application/erros';
import { Financeiro, type PedidoDoFinanceiro } from '../../application/financeiro';
import { Lancamentos } from '../../application/lancamentos';
import type { ChaveDaVisao } from '../../application/resultados';
import {
  ConsultaDaVisaoDto,
  ConsultaDoFinanceiroDto,
  ConsultaDosLancamentosDto,
  FinanceiroGeralDto,
  LancamentoDto,
  NovoLancamentoDto,
  OpcoesDosFiltrosDto,
  VisaoFinanceiraDto,
} from './dto';
import { ErrosDoFinanceiroFilter } from './erros.filter';

const VISOES: readonly ChaveDaVisao[] = [
  'setores',
  'funcionarios',
  'alunos',
  'aulas',
  'planos',
  'formas-de-pagamento',
];

const pedido = (consulta: ConsultaDoFinanceiroDto): PedidoDoFinanceiro => ({
  periodo: consulta.periodo ?? 'este-mes',
  de: consulta.de,
  ate: consulta.ate,
  comparar: consulta.comparar,
  filtro: {
    unidadeId: consulta.unidadeId,
    planoId: consulta.planoId,
    modalidade: consulta.modalidade,
    forma: consulta.forma,
    tipo: consulta.tipo,
    categoria: consulta.categoria,
  },
});

/** Financeiro no painel (`Financeiro.html` e `Fin*.html`): visão geral, visões e lançamentos. */
@ApiTags('financeiro')
@UseFilters(ErrosDoFinanceiroFilter)
@Controller('financeiro')
export class FinanceiroController {
  constructor(
    private readonly financeiro: Financeiro,
    private readonly lancamentos: Lancamentos,
  ) {}

  @Get('geral')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'financeiroGeral',
    summary:
      'Visão geral: receita líquida com comparação, KPIs, formas de pagamento e série mensal.',
  })
  @ApiOkResponse({ type: FinanceiroGeralDto })
  @ApiBadRequestResponse({ description: 'Período ou filtro inválido.' })
  geral(@Query() consulta: ConsultaDoFinanceiroDto): Promise<FinanceiroGeralDto> {
    return this.financeiro.geral(pedido(consulta));
  }

  @Get('filtros')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'opcoesDosFiltrosDoFinanceiro',
    summary: 'Unidades, planos, modalidades, formas e categorias dos filtros.',
  })
  @ApiOkResponse({ type: OpcoesDosFiltrosDto })
  filtros(): Promise<OpcoesDosFiltrosDto> {
    return this.financeiro.opcoesDosFiltros();
  }

  @Get('visoes/:visao')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'visaoDoFinanceiro',
    summary:
      'Visão do "Visualizar por": setores, funcionários, alunos, aulas, planos ou formas de pagamento (rateio da receita pelo ADR-020).',
  })
  @ApiParam({ name: 'visao', enum: VISOES })
  @ApiOkResponse({ type: VisaoFinanceiraDto })
  @ApiBadRequestResponse({ description: 'Visão, período ou filtro inválido.' })
  visao(
    @Param('visao') visao: ChaveDaVisao,
    @Query() consulta: ConsultaDaVisaoDto,
  ): Promise<VisaoFinanceiraDto> {
    if (!VISOES.includes(visao)) {
      throw new FiltroInvalidoError('Visão inexistente.');
    }
    return this.financeiro.visao(visao, pedido(consulta), {
      limite: consulta.limite,
      cursor: consulta.cursor,
    });
  }

  @Get('lancamentos')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'listarLancamentos',
    summary: 'Despesas e receitas avulsas lançadas no período, mais recentes primeiro.',
  })
  @ApiOkResponse({ type: [LancamentoDto] })
  @ApiUnprocessableEntityResponse({ description: 'Período inválido.' })
  async listar(@Query() consulta: ConsultaDosLancamentosDto): Promise<LancamentoDto[]> {
    return this.lancamentos.listar(consulta.de, consulta.ate);
  }

  @Post('lancamentos')
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'registrarLancamento',
    summary: 'Cadastra uma despesa ou receita avulsa (a folha vem do custo do funcionário).',
  })
  @ApiCreatedResponse({ type: LancamentoDto })
  @ApiUnprocessableEntityResponse({ description: 'Dados do lançamento inválidos.' })
  async registrar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: NovoLancamentoDto,
  ): Promise<LancamentoDto> {
    return this.lancamentos.registrar({ usuarioId: sessao.sujeitoId }, corpo);
  }
}
