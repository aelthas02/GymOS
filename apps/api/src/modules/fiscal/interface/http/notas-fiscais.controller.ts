import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UseFilters,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { ReivindicacoesDoAcesso } from '../../../autenticacao/application/portas';
import { RequirePermission, SessaoAtual } from '../../../autenticacao/interface/http/decoradores';
import { ConfiguracaoFiscal } from '../../application/dados-fiscais';
import { ExportacaoParaOContador } from '../../application/exportacao';
import { NotasFiscais } from '../../application/notas-fiscais';
import type { Competencia } from '../../domain/nota-fiscal';
import {
  ArquivoDaNotaDto,
  CancelamentoDaNotaDto,
  CertificadoA1Dto,
  CompetenciaDto,
  ConsultaDaPreviaDto,
  ConsultaDaSugestaoDto,
  ConsultaDeNotasDto,
  CorrecaoDaNotaDto,
  DadosFiscaisDto,
  EmitirNotaDto,
  EnvioDaNotaDto,
  NotaFiscalDetalheDto,
  NotaFiscalDto,
  PaginaDeNotasDto,
  PreviaDaNotaDto,
  ResultadoDoEnvioDto,
  ResumoDasNotasDto,
  SalvarDadosFiscaisDto,
  SugestaoDeNotaDto,
} from './dto';
import { ErrosDoFiscalFilter } from './erros.filter';
import {
  dadosFiscaisDto,
  notaDetalheDto,
  notaDto,
  previaDto,
  resumoDto,
  sugestaoDto,
} from './mapeamento';

const executor = (sessao: ReivindicacoesDoAcesso) => ({ usuarioId: sessao.sujeitoId });
const uuid = new ParseUUIDPipe({ version: '4' });
const LIMITE_PADRAO = 20;
const LIMITE_DA_ATENCAO = 10;

/** Notas fiscais no painel (`FinNotas.html` e `FinEmitir.html`). */
@ApiTags('notas-fiscais')
@UseFilters(ErrosDoFiscalFilter)
@Controller('notas-fiscais')
export class NotasFiscaisController {
  constructor(
    private readonly notas: NotasFiscais,
    private readonly exportacao: ExportacaoParaOContador,
  ) {}

  private competencia(consulta: { competencia?: string }): Competencia {
    return (consulta.competencia as Competencia | undefined) ?? this.notas.competenciaAtual();
  }

  @Get()
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'listarNotasFiscais',
    summary: '"Notas do mês": mais recentes primeiro, por cursor.',
  })
  @ApiOkResponse({ type: PaginaDeNotasDto })
  async listar(@Query() consulta: ConsultaDeNotasDto): Promise<PaginaDeNotasDto> {
    const pagina = await this.notas.listar(
      {
        competencia: this.competencia(consulta),
        ...(consulta.situacao ? { situacoes: [consulta.situacao] } : {}),
      },
      {
        limite: consulta.limite ?? LIMITE_PADRAO,
        ...(consulta.cursor ? { cursor: consulta.cursor } : {}),
      },
    );
    return { itens: pagina.itens.map(notaDto), proximoCursor: pagina.proximoCursor };
  }

  @Get('resumo')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'resumoDasNotasFiscais',
    summary: 'KPIs do mês (emitidas, valor faturado, pendentes, rejeitadas) e o resumo por tipo.',
  })
  @ApiOkResponse({ type: ResumoDasNotasDto })
  async resumo(@Query() consulta: CompetenciaDto): Promise<ResumoDasNotasDto> {
    const competencia = this.competencia(consulta);
    return resumoDto(competencia, await this.notas.resumo(competencia));
  }

  @Get('atencao')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'notasFiscaisQuePrecisamDeAtencao',
    summary: '"Precisa de atenção": rejeitadas, pendentes e em processamento.',
  })
  @ApiOkResponse({ type: [NotaFiscalDto] })
  async atencao(): Promise<NotaFiscalDto[]> {
    return (await this.notas.atencao(LIMITE_DA_ATENCAO)).map(notaDto);
  }

  @Get('previa')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'previaDaNotaFiscal',
    summary: '"Resumo da nota": ISS calculado pela alíquota da academia e total.',
  })
  @ApiOkResponse({ type: PreviaDaNotaDto })
  async previa(@Query() consulta: ConsultaDaPreviaDto): Promise<PreviaDaNotaDto> {
    return previaDto(await this.notas.previa(consulta.valorCentavos, consulta.retencoesCentavos));
  }

  @Get('sugestao')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'sugestaoDeNotaFiscal',
    summary: 'Preenche "Emitir nota": cliente do cadastro e serviço da mensalidade em aberto.',
  })
  @ApiOkResponse({ type: SugestaoDeNotaDto })
  @ApiNotFoundResponse({ description: 'Aluno não encontrado.' })
  async sugestao(@Query() consulta: ConsultaDaSugestaoDto): Promise<SugestaoDeNotaDto> {
    const sugestao = await this.notas.sugestao(consulta.alunoId, consulta.tipo);
    return sugestaoDto(sugestao, await this.notas.previa(sugestao.servico.valorCentavos));
  }

  @Get('exportacao')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'exportarNotasParaOContador',
    summary: '"Exportar para o contador": ZIP com os XMLs e o CSV da competência.',
  })
  @ApiProduces('application/zip')
  @ApiOkResponse({ description: 'Arquivo ZIP.', schema: { type: 'string', format: 'binary' } })
  async exportar(
    @Query() consulta: CompetenciaDto,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<StreamableFile> {
    const { nome, conteudo } = await this.exportacao.exportar(this.competencia(consulta));
    resposta.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
    return new StreamableFile(conteudo, { type: 'application/zip' });
  }

  @Get('alunos/:alunoId')
  @RequirePermission('financeiro:ver')
  @ApiOperation({
    operationId: 'notasFiscaisDaFichaDoAluno',
    summary: 'Notas registradas na ficha do aluno ("Aparece no financeiro dele").',
  })
  @ApiOkResponse({ type: [NotaFiscalDto] })
  async daFicha(@Param('alunoId', uuid) alunoId: string): Promise<NotaFiscalDto[]> {
    return (await this.notas.daFicha(alunoId)).map(notaDto);
  }

  @Post()
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'emitirNotaFiscal',
    summary:
      'Emite a nota manual; sem resposta do emissor, fica "processando" e é conferida depois.',
  })
  @ApiCreatedResponse({ type: NotaFiscalDetalheDto })
  @ApiNotFoundResponse({ description: 'Aluno não encontrado.' })
  @ApiUnprocessableEntityResponse({ description: 'CPF inválido ou dados fiscais ausentes.' })
  async emitir(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: EmitirNotaDto,
  ): Promise<NotaFiscalDetalheDto> {
    const nota = await this.notas.emitirManual(executor(sessao), {
      ...corpo,
      competencia: corpo.competencia as Competencia,
    });
    return notaDetalheDto(nota);
  }

  @Get(':id')
  @RequirePermission('financeiro:ver')
  @ApiOperation({ operationId: 'obterNotaFiscal', summary: 'Detalhe da nota (drawer "Ver").' })
  @ApiOkResponse({ type: NotaFiscalDetalheDto })
  @ApiNotFoundResponse({ description: 'Nota não encontrada.' })
  async obter(@Param('id', uuid) id: string): Promise<NotaFiscalDetalheDto> {
    return notaDetalheDto(await this.notas.obter(id));
  }

  @Get(':id/arquivos/:arquivo')
  @RequirePermission('financeiro:ver')
  @ApiParam({ name: 'arquivo', enum: ['pdf', 'xml'] })
  @ApiOperation({ operationId: 'arquivoDaNotaFiscal', summary: 'URL assinada do PDF ou do XML.' })
  @ApiOkResponse({ type: ArquivoDaNotaDto })
  @ApiNotFoundResponse({ description: 'Nota ou arquivo não encontrado.' })
  async arquivo(
    @Param('id', uuid) id: string,
    @Param('arquivo') arquivo: string,
  ): Promise<ArquivoDaNotaDto> {
    const { url, expiraEm } = await this.notas.urlDoArquivo(id, arquivo === 'xml' ? 'xml' : 'pdf');
    return { url, expiraEm: expiraEm.toISOString() };
  }

  @Post(':id/reenvio')
  @HttpCode(200)
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'reenviarNotaFiscal',
    summary: '"Emitir" ou "Reenviar": consulta o emissor pela chave antes de reemitir.',
  })
  @ApiOkResponse({ type: NotaFiscalDetalheDto })
  @ApiConflictResponse({ description: 'Nota já emitida ou cancelada.' })
  async reenviar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<NotaFiscalDetalheDto> {
    return notaDetalheDto(await this.notas.reenviar(executor(sessao), id));
  }

  @Post(':id/correcao')
  @HttpCode(200)
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'corrigirNotaFiscal',
    summary: '"Corrigir": troca CPF, descrição ou valor da nota rejeitada e reenvia.',
  })
  @ApiOkResponse({ type: NotaFiscalDetalheDto })
  @ApiConflictResponse({ description: 'A nota não está rejeitada nem pendente.' })
  @ApiUnprocessableEntityResponse({ description: 'CPF ou valor inválido.' })
  async corrigir(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: CorrecaoDaNotaDto,
  ): Promise<NotaFiscalDetalheDto> {
    return notaDetalheDto(await this.notas.corrigir(executor(sessao), id, corpo));
  }

  @Post(':id/cancelamento')
  @HttpCode(200)
  @RequirePermission('financeiro:excluir')
  @ApiOperation({ operationId: 'cancelarNotaFiscal', summary: 'Cancela no emissor e aqui.' })
  @ApiOkResponse({ type: NotaFiscalDetalheDto })
  @ApiConflictResponse({ description: 'Nota já cancelada ou em processamento.' })
  async cancelar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: CancelamentoDaNotaDto,
  ): Promise<NotaFiscalDetalheDto> {
    return notaDetalheDto(await this.notas.cancelar(executor(sessao), id, corpo.motivo));
  }

  @Post(':id/envio')
  @HttpCode(200)
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'enviarNotaFiscalAoAluno',
    summary: 'Envia ao aluno por e-mail e WhatsApp (transacional), com os links do PDF e do XML.',
  })
  @ApiOkResponse({ type: ResultadoDoEnvioDto })
  @ApiUnprocessableEntityResponse({ description: 'A nota não está emitida.' })
  async enviar(
    @Param('id', uuid) id: string,
    @Body() corpo: EnvioDaNotaDto,
  ): Promise<ResultadoDoEnvioDto> {
    return this.notas.enviarAoAluno(id, corpo);
  }

  @Post(':id/ficha')
  @HttpCode(200)
  @RequirePermission('financeiro:criar')
  @ApiOperation({
    operationId: 'registrarNotaFiscalNaFicha',
    summary: 'Registra a nota na ficha do aluno.',
  })
  @ApiOkResponse({ type: NotaFiscalDto })
  async registrarNaFicha(@Param('id', uuid) id: string): Promise<NotaFiscalDto> {
    return notaDto(await this.notas.registrarNaFicha(id));
  }
}

/** Bloco "Dados fiscais e notas" de Configurações (a tela é do T26c). */
@ApiTags('configuracoes')
@UseFilters(ErrosDoFiscalFilter)
@Controller('configuracoes/fiscal')
export class DadosFiscaisController {
  constructor(private readonly configuracao: ConfiguracaoFiscal) {}

  @Get()
  @RequirePermission('configuracoes.fiscal:ver')
  @ApiOperation({
    operationId: 'obterDadosFiscais',
    summary: 'Dados fiscais, regra "Quando emitir", certificado A1 e o emissor.',
  })
  @ApiOkResponse({ type: DadosFiscaisDto })
  async obter(): Promise<DadosFiscaisDto> {
    return dadosFiscaisDto(await this.configuracao.obter());
  }

  @Put()
  @RequirePermission('configuracoes.fiscal:editar')
  @ApiOperation({
    operationId: 'salvarDadosFiscais',
    summary: 'Salva os dados e a regra de emissão.',
  })
  @ApiOkResponse({ type: DadosFiscaisDto })
  @ApiUnprocessableEntityResponse({ description: 'CNPJ ou alíquota inválidos.' })
  async salvar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: SalvarDadosFiscaisDto,
  ): Promise<DadosFiscaisDto> {
    return dadosFiscaisDto(await this.configuracao.salvar(executor(sessao), corpo));
  }

  @Put('certificado')
  @RequirePermission('configuracoes.fiscal:editar')
  @ApiOperation({
    operationId: 'trocarCertificadoA1',
    summary: '"Trocar": envia o certificado A1 ao emissor e guarda só a validade.',
  })
  @ApiOkResponse({ type: DadosFiscaisDto })
  @ApiUnprocessableEntityResponse({ description: 'Dados fiscais ausentes ou arquivo vazio.' })
  async certificado(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: CertificadoA1Dto,
  ): Promise<DadosFiscaisDto> {
    return dadosFiscaisDto(
      await this.configuracao.enviarCertificado(
        executor(sessao),
        Buffer.from(corpo.arquivoBase64, 'base64'),
        corpo.senha,
      ),
    );
  }
}
