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
import {
  Autenticado,
  RequirePermission,
  SessaoAtual,
} from '../../../autenticacao/interface/http/decoradores';
import { Alunos } from '../../application/alunos';
import { ConfiguracaoDosContratos, Contratos } from '../../application/contratos';
import { ImportarAlunos } from '../../application/importacao';
import {
  AderirDto,
  AlunoDto,
  CadastrarAlunoDto,
  CodigoDeAcessoDto,
  ConsultaDeAlunosDto,
  ContratoDto,
  DadosDoAlunoDto,
  ExcluirAlunoDto,
  ImportarAlunosDto,
  PaginaDeAlunosDto,
  RelatorioDaImportacaoDto,
  SituacaoDoAlunoDto,
  TrancarDto,
} from './dto';
import { ErrosDosAlunosFilter } from './erros.filter';
import {
  alunoDto,
  contratoDto,
  dadosPessoais,
  dia,
  itemDaListaDto,
  situacaoDto,
} from './mapeamento';

const executor = (sessao: ReivindicacoesDoAcesso) => ({ usuarioId: sessao.sujeitoId });
const uuid = new ParseUUIDPipe({ version: '4' });

@ApiTags('alunos')
@UseFilters(ErrosDosAlunosFilter)
@Controller('alunos')
export class AlunosController {
  constructor(
    private readonly alunos: Alunos,
    private readonly contratos: Contratos,
    private readonly configuracao: ConfiguracaoDosContratos,
    private readonly importar: ImportarAlunos,
  ) {}

  @Get()
  @RequirePermission('alunos:ver')
  @ApiOperation({
    operationId: 'listarAlunos',
    summary:
      'Lista paginada por cursor, com filtros e os contadores Todos/Em dia/A vencer/Em atraso.',
  })
  @ApiOkResponse({ type: PaginaDeAlunosDto })
  @ApiBadRequestResponse({ description: 'Filtro ou cursor inválido.' })
  async listar(@Query() consulta: ConsultaDeAlunosDto): Promise<PaginaDeAlunosDto> {
    const pagina = await this.alunos.listar(
      { situacao: consulta.situacao, planoId: consulta.planoId, busca: consulta.busca },
      { limite: consulta.limite, cursor: consulta.cursor },
    );
    const hoje = this.contratos.hoje();
    const config = await this.configuracao.obter();
    return {
      itens: pagina.itens.map((item) => itemDaListaDto(item, hoje, config)),
      proximoCursor: pagina.proximoCursor,
      contadores: pagina.contadores,
    };
  }

  @Post()
  @RequirePermission('alunos:criar')
  @ApiOperation({
    operationId: 'cadastrarAluno',
    summary: 'Cadastra o aluno; com plano, já cria o contrato (adesão).',
  })
  @ApiCreatedResponse({ type: AlunoDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos (CPF, e-mail, datas).' })
  @ApiConflictResponse({ description: 'CPF já cadastrado ou plano inativo.' })
  async cadastrar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: CadastrarAlunoDto,
  ): Promise<AlunoDto> {
    const inicio = dia(corpo.inicioDoContrato, 'inicioDoContrato');
    const aluno = await this.alunos.cadastrar(executor(sessao), {
      ...dadosPessoais(corpo),
      ...(corpo.unidadeId ? { unidadeId: corpo.unidadeId } : {}),
      ...(corpo.planoId ? { planoId: corpo.planoId } : {}),
      ...(inicio ? { inicioDoContrato: inicio } : {}),
      consentimentos: corpo.consentimentos ?? [],
    });
    return alunoDto(aluno);
  }

  @Post('importacao')
  @HttpCode(200)
  @RequirePermission('alunos:criar')
  @ApiOperation({
    operationId: 'importarAlunos',
    summary:
      'Importação em lote: pula CPF inválido, já cadastrado ou repetido; plano inexistente cria o aluno sem contrato.',
  })
  @ApiOkResponse({ type: RelatorioDaImportacaoDto })
  async importarPlanilha(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: ImportarAlunosDto,
  ): Promise<RelatorioDaImportacaoDto> {
    return this.importar.executar(
      executor(sessao),
      corpo.linhas.map((linha, indice) => ({
        ...linha,
        dataNascimento: dia(linha.dataNascimento, `linhas[${indice}].dataNascimento`),
        inicioDoContrato: dia(linha.inicioDoContrato, `linhas[${indice}].inicioDoContrato`),
      })),
    );
  }

  @Get(':id')
  @RequirePermission('alunos:ver')
  @ApiOperation({
    operationId: 'obterAluno',
    summary: 'Cadastro do aluno (a leitura das restrições vai para o log de acesso).',
  })
  @ApiOkResponse({ type: AlunoDto })
  @ApiNotFoundResponse({ description: 'Aluno não encontrado.' })
  async obter(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<AlunoDto> {
    return alunoDto(await this.alunos.obter(id, sessao.sujeitoId));
  }

  @Put(':id')
  @RequirePermission('alunos:editar')
  @ApiOperation({ operationId: 'editarAluno', summary: 'Edita o cadastro do aluno.' })
  @ApiOkResponse({ type: AlunoDto })
  @ApiNotFoundResponse({ description: 'Aluno não encontrado.' })
  @ApiConflictResponse({ description: 'CPF de outro aluno.' })
  async editar(@Param('id', uuid) id: string, @Body() corpo: DadosDoAlunoDto): Promise<AlunoDto> {
    return alunoDto(await this.alunos.editar(id, dadosPessoais(corpo)));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('alunos:excluir')
  @ApiOperation({
    operationId: 'excluirAluno',
    summary: 'Exclui o aluno em todos os domínios (LGPD) e grava a auditoria sensível.',
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Aluno não encontrado.' })
  async excluir(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: ExcluirAlunoDto,
  ): Promise<void> {
    await this.alunos.excluir(executor(sessao), id, corpo?.motivo);
  }

  @Post(':id/codigo-de-acesso')
  @RequirePermission('alunos:editar')
  @ApiOperation({
    operationId: 'gerarCodigoDeAcessoDoAluno',
    summary: 'Código de primeiro acesso ao app, entregue pela recepção (7 dias, uso único).',
  })
  @ApiCreatedResponse({ type: CodigoDeAcessoDto })
  @ApiNotFoundResponse({ description: 'Aluno não encontrado.' })
  async gerarCodigo(@Param('id', uuid) id: string): Promise<CodigoDeAcessoDto> {
    return { codigo: await this.alunos.gerarCodigoDeAcesso(id) };
  }

  @Get(':id/situacao')
  @RequirePermission('alunos:ver')
  @ApiOperation({
    operationId: 'obterSituacaoDoAluno',
    summary:
      'Estado do contrato hoje (ADR-018), dias de atraso, "encerra em" e situação de vencimento.',
  })
  @ApiOkResponse({ type: SituacaoDoAlunoDto })
  async situacao(@Param('id', uuid) id: string): Promise<SituacaoDoAlunoDto> {
    await this.alunos.obterNome(id);
    return situacaoDto(await this.contratos.situacao(id));
  }

  @Get(':id/contrato')
  @RequirePermission('alunos:ver')
  @ApiOperation({ operationId: 'obterContratoVigente', summary: 'Contrato vigente do aluno.' })
  @ApiOkResponse({ type: ContratoDto })
  @ApiNotFoundResponse({ description: 'Aluno sem contrato.' })
  async contrato(@Param('id', uuid) id: string): Promise<ContratoDto> {
    return contratoDto(await this.contratos.vigente(id));
  }

  @Post(':id/contratos')
  @RequirePermission('alunos:editar')
  @ApiOperation({
    operationId: 'aderirAPlano',
    summary: 'Nova adesão: o contrato passa a ser o vigente.',
  })
  @ApiCreatedResponse({ type: ContratoDto })
  @ApiConflictResponse({ description: 'Plano inativo para venda.' })
  async aderir(@Param('id', uuid) id: string, @Body() corpo: AderirDto): Promise<ContratoDto> {
    await this.alunos.obterNome(id);
    const inicio = dia(corpo.inicio, 'inicio') ?? undefined;
    return contratoDto(await this.contratos.aderir(id, corpo.planoId, inicio));
  }

  @Post(':id/contrato/renovar')
  @HttpCode(200)
  @RequirePermission('alunos:editar')
  @ApiOperation({ operationId: 'renovarContrato', summary: 'Renova por mais um período do plano.' })
  @ApiOkResponse({ type: ContratoDto })
  @ApiConflictResponse({ description: 'Contrato encerrado por atraso ou trancado.' })
  async renovar(@Param('id', uuid) id: string): Promise<ContratoDto> {
    return contratoDto(await this.contratos.renovar(id));
  }

  @Post(':id/contrato/trancar')
  @HttpCode(200)
  @RequirePermission('alunos:editar')
  @ApiOperation({
    operationId: 'trancarContrato',
    summary:
      'Tranca por N dias (até o máximo configurado); a vigência é estendida pelo mesmo tempo.',
  })
  @ApiOkResponse({ type: ContratoDto })
  @ApiConflictResponse({ description: 'Prazo acima do máximo ou contrato encerrado.' })
  async trancar(@Param('id', uuid) id: string, @Body() corpo: TrancarDto): Promise<ContratoDto> {
    return contratoDto(await this.contratos.trancar(id, corpo.dias));
  }

  @Post(':id/contrato/destrancar')
  @HttpCode(200)
  @RequirePermission('alunos:editar')
  @ApiOperation({
    operationId: 'destrancarContrato',
    summary: 'Destranca; os dias de trancamento não usados saem da vigência.',
  })
  @ApiOkResponse({ type: ContratoDto })
  @ApiConflictResponse({ description: 'O contrato não está trancado.' })
  async destrancar(@Param('id', uuid) id: string): Promise<ContratoDto> {
    return contratoDto(await this.contratos.destrancar(id));
  }
}

/** O contrato do próprio aluno no app (tela Plano e "Renovar com 1 toque"). */
@ApiTags('app')
@UseFilters(ErrosDosAlunosFilter)
@Controller('app/contrato')
export class ContratoDoAppController {
  constructor(private readonly contratos: Contratos) {}

  @Get()
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'obterMeuContrato',
    summary: 'Situação e contrato vigente do aluno da sessão.',
  })
  @ApiOkResponse({ type: SituacaoDoAlunoDto })
  async obter(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<SituacaoDoAlunoDto> {
    return situacaoDto(await this.contratos.situacao(sessao.sujeitoId));
  }

  @Post('renovar')
  @HttpCode(200)
  @Autenticado('aluno')
  @ApiOperation({ operationId: 'renovarMeuContrato', summary: '"Renovar com 1 toque" do app.' })
  @ApiOkResponse({ type: ContratoDto })
  @ApiConflictResponse({ description: 'Contrato encerrado por atraso ou trancado.' })
  async renovar(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<ContratoDto> {
    return contratoDto(await this.contratos.renovar(sessao.sujeitoId));
  }
}
