import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ehDataCivil } from '../../../alunos/domain/datas';
import type { ReivindicacoesDoAcesso } from '../../../autenticacao/application/portas';
import {
  Autenticado,
  RequirePermission,
  SessaoAtual,
} from '../../../autenticacao/interface/http/decoradores';
import { Pagamentos } from '../../application/pagamentos';
import { Parcelas } from '../../application/parcelas';
import {
  CobrancaDto,
  CobrancaEmLoteDto,
  EnviarCobrancaDto,
  EstornoDto,
  FormaDePagamentoDoAlunoDto,
  FormaDePagamentoDto,
  NovaDataDto,
  PagamentoDto,
  PagamentoNoBalcaoDto,
  ParcelaDto,
  PendenciaDto,
  ResultadoDoLoteDto,
  SegundaViaDoAppDto,
  SegundaViaDto,
} from './dto';
import { ErrosDaCobrancaFilter } from './erros.filter';
import { cobrancaDto, formaDto, pagamentoDto, parcelaDto, pendenciaDto } from './mapeamento';

const executor = (sessao: ReivindicacoesDoAcesso) => ({ usuarioId: sessao.sujeitoId });
const uuid = new ParseUUIDPipe({ version: '4' });

/** Cobrança no painel: parcelas, pagamentos, links, balcão, nova data, estorno e lote. */
@ApiTags('cobranca')
@UseFilters(ErrosDaCobrancaFilter)
@Controller('cobranca')
export class CobrancaController {
  constructor(
    private readonly parcelas: Parcelas,
    private readonly pagamentos: Pagamentos,
  ) {}

  @Get('alunos/:alunoId/parcelas')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'listarParcelasDoAluno',
    summary: 'Parcelas do aluno por vencimento, com saldo e dias de atraso.',
  })
  @ApiOkResponse({ type: [ParcelaDto] })
  async parcelasDoAluno(@Param('alunoId', uuid) alunoId: string): Promise<ParcelaDto[]> {
    const hoje = this.parcelas.hoje();
    return (await this.parcelas.doAluno(alunoId)).map((parcela) => parcelaDto(parcela, hoje));
  }

  @Get('alunos/:alunoId/pagamentos')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'listarPagamentosDoAluno',
    summary: 'Pagamentos, mais recentes primeiro.',
  })
  @ApiOkResponse({ type: [PagamentoDto] })
  async pagamentosDoAluno(@Param('alunoId', uuid) alunoId: string): Promise<PagamentoDto[]> {
    return (await this.pagamentos.pagamentosDoAluno(alunoId)).map(pagamentoDto);
  }

  @Post('parcelas/:id/link')
  @HttpCode(200)
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'enviarLinkDePagamento',
    summary: 'Envia ao aluno o link de pagamento da parcela (reaproveita a cobrança pendente).',
  })
  @ApiOkResponse({ type: CobrancaDto })
  @ApiNotFoundResponse({ description: 'Parcela não encontrada.' })
  @ApiConflictResponse({ description: 'Parcela quitada ou sem cartão cadastrado.' })
  async enviarLink(
    @Param('id', uuid) id: string,
    @Body() corpo: EnviarCobrancaDto,
  ): Promise<CobrancaDto> {
    return cobrancaDto(await this.pagamentos.enviarLink(id, corpo.forma ?? 'link'));
  }

  @Post('parcelas/:id/segunda-via')
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'emitirSegundaVia',
    summary: 'Cancela as cobranças pendentes da parcela e emite outra pelo saldo.',
  })
  @ApiCreatedResponse({ type: CobrancaDto })
  @ApiNotFoundResponse({ description: 'Parcela não encontrada.' })
  @ApiConflictResponse({ description: 'Parcela quitada ou sem cartão cadastrado.' })
  async segundaVia(
    @Param('id', uuid) id: string,
    @Body() corpo: SegundaViaDto,
  ): Promise<CobrancaDto> {
    return cobrancaDto(
      await this.pagamentos.segundaVia(id, corpo.forma, { enviar: corpo.enviar ?? true }),
    );
  }

  @Post('parcelas/:id/nova-data')
  @HttpCode(200)
  @RequirePermission('alunos:editar')
  @ApiOperation({
    operationId: 'combinarNovaData',
    summary: 'Adia o vencimento (hoje ou depois), zera o atraso e grava a auditoria.',
  })
  @ApiOkResponse({ type: ParcelaDto })
  @ApiNotFoundResponse({ description: 'Parcela não encontrada.' })
  @ApiConflictResponse({ description: 'Parcela quitada ou data inválida.' })
  async novaData(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: NovaDataDto,
  ): Promise<ParcelaDto> {
    if (!ehDataCivil(corpo.vencimento)) {
      throw new BadRequestException('vencimento: data inexistente.');
    }
    const parcela = await this.parcelas.combinarNovaData(
      executor(sessao),
      id,
      corpo.vencimento,
      corpo.motivo,
    );
    return parcelaDto(parcela, this.parcelas.hoje());
  }

  @Post('pagamentos')
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'registrarPagamentoNoBalcao',
    summary:
      'Baixa no balcão (dinheiro, PIX ou maquininha). Menor que o saldo fica como pago parcial; parcela já quitada vira pagamento em duplicidade.',
  })
  @ApiCreatedResponse({ type: PagamentoDto })
  @ApiNotFoundResponse({ description: 'Parcela não encontrada.' })
  @ApiConflictResponse({ description: 'Valor acima do saldo ou avulso sem origem.' })
  async registrarPagamento(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: PagamentoNoBalcaoDto,
  ): Promise<PagamentoDto> {
    return pagamentoDto(
      await this.pagamentos.registrarNoBalcao(executor(sessao), {
        alunoId: corpo.alunoId,
        parcelaId: corpo.parcelaId ?? null,
        valorCentavos: corpo.valorCentavos,
        forma: corpo.forma,
        taxaCentavos: corpo.taxaCentavos,
        origem: corpo.origem,
      }),
    );
  }

  @Post('pagamentos/:id/estorno')
  @HttpCode(200)
  @RequirePermission('financeiro:excluir')
  @ApiOperation({
    operationId: 'estornarPagamento',
    summary: 'Estorno total ou parcial; reabre a parcela e publica PagamentoEstornado.',
  })
  @ApiOkResponse({ type: PagamentoDto })
  @ApiNotFoundResponse({ description: 'Pagamento não encontrado.' })
  @ApiConflictResponse({ description: 'Valor acima do disponível ou já estornado.' })
  async estornar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: EstornoDto,
  ): Promise<PagamentoDto> {
    return pagamentoDto(
      await this.pagamentos.estornar(executor(sessao), id, corpo.motivo, corpo.valorCentavos),
    );
  }

  @Post('lote')
  @HttpCode(200)
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'enviarCobrancaEmLote',
    summary: 'Envia o link da parcela vencida mais antiga de cada aluno (mensagem transacional).',
  })
  @ApiOkResponse({ type: ResultadoDoLoteDto })
  async lote(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: CobrancaEmLoteDto,
  ): Promise<ResultadoDoLoteDto> {
    return this.pagamentos.cobrancaEmLote(executor(sessao), corpo.alunoIds);
  }

  @Get('alunos/:alunoId/forma-de-pagamento')
  @RequirePermission('financeiro:ver')
  @ApiOperation({ operationId: 'obterFormaDePagamento', summary: 'Forma de pagamento preferida.' })
  @ApiOkResponse({ type: FormaDePagamentoDoAlunoDto })
  @ApiNotFoundResponse({ description: 'Aluno sem forma de pagamento.' })
  async forma(@Param('alunoId', uuid) alunoId: string): Promise<FormaDePagamentoDoAlunoDto> {
    const forma = await this.pagamentos.formaDoAluno(alunoId);
    if (!forma) {
      throw new NotFoundException('Forma de pagamento não encontrada.');
    }
    return formaDto(forma);
  }

  @Put('alunos/:alunoId/forma-de-pagamento')
  @RequirePermission('alunos:editar')
  @ApiOperation({
    operationId: 'trocarFormaDePagamento',
    summary: 'Troca a forma de pagamento; cartão só com o token do provedor.',
  })
  @ApiOkResponse({ type: FormaDePagamentoDoAlunoDto })
  async trocarForma(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('alunoId', uuid) alunoId: string,
    @Body() corpo: FormaDePagamentoDto,
  ): Promise<FormaDePagamentoDoAlunoDto> {
    return formaDto(await this.pagamentos.trocarFormaDePagamento(executor(sessao), alunoId, corpo));
  }

  @Get('pendencias')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'listarPendenciasDaCobranca',
    summary: 'Mensalidades em atraso e pagamentos em duplicidade a estornar (provedor do T18).',
  })
  @ApiOkResponse({ type: [PendenciaDto] })
  async pendencias(): Promise<PendenciaDto[]> {
    return (await this.parcelas.pendencias()).map(pendenciaDto);
  }
}

/** Parcelas, pagamentos e segunda via no app do aluno (T33). */
@ApiTags('app')
@UseFilters(ErrosDaCobrancaFilter)
@Controller('app/cobranca')
export class CobrancaDoAppController {
  constructor(
    private readonly parcelas: Parcelas,
    private readonly pagamentos: Pagamentos,
  ) {}

  @Get('parcelas')
  @Autenticado('aluno')
  @ApiOperation({ operationId: 'listarMinhasParcelas', summary: 'Parcelas do aluno da sessão.' })
  @ApiOkResponse({ type: [ParcelaDto] })
  async parcelasDoAluno(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<ParcelaDto[]> {
    const hoje = this.parcelas.hoje();
    return (await this.parcelas.doAluno(sessao.sujeitoId)).map((parcela) =>
      parcelaDto(parcela, hoje),
    );
  }

  @Get('pagamentos')
  @Autenticado('aluno')
  @ApiOperation({ operationId: 'listarMeusPagamentos', summary: 'Pagamentos do aluno da sessão.' })
  @ApiOkResponse({ type: [PagamentoDto] })
  async pagamentosDoAluno(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<PagamentoDto[]> {
    return (await this.pagamentos.pagamentosDoAluno(sessao.sujeitoId)).map(pagamentoDto);
  }

  @Post('parcelas/:id/segunda-via')
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'emitirMinhaSegundaVia',
    summary: 'Segunda via (PIX, boleto, cartão ou link) de uma parcela do próprio aluno.',
  })
  @ApiCreatedResponse({ type: CobrancaDto })
  @ApiNotFoundResponse({ description: 'Parcela não encontrada.' })
  @ApiConflictResponse({ description: 'Parcela quitada ou sem cartão cadastrado.' })
  async segundaVia(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: SegundaViaDoAppDto,
  ): Promise<CobrancaDto> {
    return cobrancaDto(
      await this.pagamentos.segundaVia(id, corpo.forma, {
        enviar: false,
        doAluno: sessao.sujeitoId,
      }),
    );
  }
}
