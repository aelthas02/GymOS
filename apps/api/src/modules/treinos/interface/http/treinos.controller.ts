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
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import type { DataCivil } from '../../../platform/domain/relogio';
import { NaoEncontradoError } from '../../application/erros';
import { LIMITE_PADRAO_DAS_FICHAS, Treinos } from '../../application/treinos';
import {
  AcompanhamentoDeTreinoDto,
  AvisoDeVencimentoDto,
  ConsultaDeExerciciosDto,
  ConsultaDeFichasDto,
  DadosDoExercicioDto,
  DadosDoModeloDto,
  ExecucaoDto,
  ExercicioDto,
  FichaDoAppDto,
  FichaDto,
  GerarFichaDto,
  ModeloDto,
  PainelDeFichasDto,
  PendenciaDeFichaDto,
  RegistrarExecucaoDto,
  SalvarFichaDto,
  UsarModeloDto,
} from './dto';
import { ErrosDosTreinosFilter } from './erros.filter';
import { exercicioDto, fichaDto, linhaDeFichaDto, modeloDto } from './mapeamento';

const executor = (sessao: ReivindicacoesDoAcesso) => ({ usuarioId: sessao.sujeitoId });
const uuid = new ParseUUIDPipe({ version: '4' });
const dia = (valor: string | null | undefined): DataCivil | null =>
  (valor ?? null) as DataCivil | null;

/** Treinos no painel (T25): fichas, modelos, biblioteca e a ficha de cada aluno. */
@ApiTags('treinos')
@UseFilters(ErrosDosTreinosFilter)
@Controller('treinos')
export class TreinosController {
  constructor(private readonly treinos: Treinos) {}

  // ---------- Fichas ----------

  @Get('fichas')
  @RequirePermission('treinos:ver')
  @ApiOperation({
    operationId: 'painelDeFichas',
    summary: 'KPIs, tabela de fichas e fichas sugeridas pela IA (TreinosFichas).',
  })
  @ApiOkResponse({ type: PainelDeFichasDto })
  async painel(@Query() consulta: ConsultaDeFichasDto): Promise<PainelDeFichasDto> {
    const pagina = consulta.pagina ?? 1;
    const limite = consulta.limite ?? LIMITE_PADRAO_DAS_FICHAS;
    const painel = await this.treinos.painel(pagina, limite);
    return {
      kpis: painel.kpis,
      itens: painel.itens.map(linhaDeFichaDto),
      total: painel.total,
      pagina,
      limite,
      alunosComFicha: painel.alunosComFicha,
      sugeridas: painel.sugeridas,
    };
  }

  @Post('fichas/avisar-vencimentos')
  @HttpCode(200)
  @RequirePermission('treinos:editar')
  @ApiOperation({
    operationId: 'avisarFichasQueVencem',
    summary: '"Avisar alunos": notifica quem tem ficha vencendo em até 30 dias.',
  })
  @ApiOkResponse({ type: AvisoDeVencimentoDto })
  avisarVencimentos(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<AvisoDeVencimentoDto> {
    return this.treinos.avisarVencimentos(executor(sessao));
  }

  @Post('fichas/:id/aprovar')
  @HttpCode(200)
  @RequirePermission('treinos:editar')
  @ApiOperation({
    operationId: 'aprovarFicha',
    summary: 'Aprova a ficha: registra o professor e a data, ativa e avisa o aluno.',
  })
  @ApiOkResponse({ type: FichaDto })
  @ApiNotFoundResponse({ description: 'Ficha não está aguardando aprovação.' })
  async aprovar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<FichaDto> {
    return fichaDto(await this.treinos.aprovar(executor(sessao), id));
  }

  @Post('fichas/:id/recusar')
  @HttpCode(204)
  @RequirePermission('treinos:editar')
  @ApiOperation({ operationId: 'recusarFicha', summary: 'Recusa a ficha sugerida pela IA.' })
  @ApiNotFoundResponse({ description: 'Ficha não está aguardando aprovação.' })
  async recusar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.treinos.recusar(executor(sessao), id);
  }

  @Get('pendencias')
  @RequirePermission('treinos:ver')
  @ApiOperation({
    operationId: 'listarPendenciasDeTreinos',
    summary:
      'Fichas para aprovar: provedor de pendências do Início ("Ficha de treino para aprovar").',
  })
  @ApiOkResponse({ type: [PendenciaDeFichaDto] })
  pendencias(): Promise<PendenciaDeFichaDto[]> {
    return this.treinos.pendencias();
  }

  // ---------- Ficha de um aluno ----------

  @Get('alunos/:alunoId/ficha')
  @RequirePermission('treinos:ver')
  @ApiOperation({
    operationId: 'buscarFichaDoAluno',
    summary: 'A ficha em andamento do aluno (rascunho, aguardando aprovação ou ativa).',
  })
  @ApiOkResponse({ type: FichaDto })
  @ApiNotFoundResponse({ description: 'O aluno não existe ou ainda não tem ficha.' })
  async fichaDoAluno(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('alunoId', uuid) alunoId: string,
  ): Promise<FichaDto> {
    return fichaDto(await this.treinos.fichaDoAluno(executor(sessao), alunoId));
  }

  @Put('alunos/:alunoId/ficha')
  @RequirePermission('treinos:editar')
  @ApiOperation({
    operationId: 'salvarFichaDoAluno',
    summary: 'Salva o rascunho ou, com `enviar`, aprova e envia a ficha ao aluno.',
  })
  @ApiOkResponse({ type: FichaDto })
  @ApiBadRequestResponse({ description: 'Treinos ou campos inválidos.' })
  async salvar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('alunoId', uuid) alunoId: string,
    @Body() corpo: SalvarFichaDto,
  ): Promise<FichaDto> {
    const { enviar, validaAte, nome, restricoes, ...resto } = corpo;
    return fichaDto(
      await this.treinos.salvar(
        executor(sessao),
        alunoId,
        { ...resto, nome: nome ?? '', validaAte: dia(validaAte), restricoes: restricoes ?? null },
        enviar,
      ),
    );
  }

  @Post('alunos/:alunoId/ficha/gerar-com-ia')
  @HttpCode(200)
  @RequirePermission('treinos:criar')
  @ApiOperation({
    operationId: 'gerarFichaComIA',
    summary:
      'Gera o rascunho pela IA a partir de objetivo, nível, frequência e restrições. Sempre nasce "Aguardando aprovação".',
  })
  @ApiOkResponse({ type: FichaDto })
  async gerarComIA(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('alunoId', uuid) alunoId: string,
    @Body() corpo: GerarFichaDto,
  ): Promise<FichaDto> {
    const { validaAte, restricoes, ...resto } = corpo;
    return fichaDto(
      await this.treinos.gerarComIA(executor(sessao), alunoId, {
        ...resto,
        restricoes: restricoes?.trim() || null,
        validaAte: dia(validaAte),
      }),
    );
  }

  @Get('alunos/:alunoId/acompanhamento')
  @RequirePermission('alunos:ver')
  @ApiOperation({
    operationId: 'acompanhamentoDeTreinoDoAluno',
    summary: 'Evolução de carga, esforço e resumo da ficha, para o Acompanhamento (T16).',
  })
  @ApiOkResponse({ type: AcompanhamentoDeTreinoDto })
  acompanhamento(@Param('alunoId', uuid) alunoId: string): Promise<AcompanhamentoDeTreinoDto> {
    return this.treinos.acompanhamento(alunoId);
  }

  // ---------- Biblioteca ----------

  @Get('exercicios')
  @RequirePermission('treinos:ver')
  @ApiOperation({
    operationId: 'listarExercicios',
    summary: 'Biblioteca de exercícios, por grupo.',
  })
  @ApiOkResponse({ type: [ExercicioDto] })
  async exercicios(@Query() consulta: ConsultaDeExerciciosDto): Promise<ExercicioDto[]> {
    return (await this.treinos.listarExercicios(consulta.grupo)).map(exercicioDto);
  }

  @Post('exercicios')
  @RequirePermission('treinos:criar')
  @ApiOperation({
    operationId: 'cadastrarExercicio',
    summary: 'Cadastra um exercício na biblioteca.',
  })
  @ApiCreatedResponse({ type: ExercicioDto })
  @ApiBadRequestResponse({ description: 'Campos inválidos ou vídeo que não é do YouTube.' })
  @ApiConflictResponse({ description: 'Já existe um exercício com esse nome.' })
  async cadastrarExercicio(@Body() corpo: DadosDoExercicioDto): Promise<ExercicioDto> {
    return exercicioDto(
      await this.treinos.cadastrarExercicio({
        ...corpo,
        videoUrl: corpo.videoUrl ?? null,
        instrucoes: corpo.instrucoes ?? null,
      }),
    );
  }

  @Put('exercicios/:id')
  @RequirePermission('treinos:editar')
  @ApiOperation({ operationId: 'editarExercicio', summary: 'Edita um exercício da biblioteca.' })
  @ApiOkResponse({ type: ExercicioDto })
  @ApiNotFoundResponse({ description: 'Exercício não encontrado.' })
  async editarExercicio(
    @Param('id', uuid) id: string,
    @Body() corpo: DadosDoExercicioDto,
  ): Promise<ExercicioDto> {
    return exercicioDto(
      await this.treinos.editarExercicio(id, {
        ...corpo,
        videoUrl: corpo.videoUrl ?? null,
        instrucoes: corpo.instrucoes ?? null,
      }),
    );
  }

  // ---------- Modelos ----------

  @Get('modelos')
  @RequirePermission('treinos:ver')
  @ApiOperation({ operationId: 'listarModelosDeTreino', summary: 'Modelos de ficha.' })
  @ApiOkResponse({ type: [ModeloDto] })
  async modelos(): Promise<ModeloDto[]> {
    return (await this.treinos.listarModelos()).map(modeloDto);
  }

  @Post('modelos')
  @RequirePermission('treinos:criar')
  @ApiOperation({ operationId: 'criarModeloDeTreino', summary: 'Cria um modelo de ficha.' })
  @ApiCreatedResponse({ type: ModeloDto })
  @ApiConflictResponse({ description: 'Já existe um modelo com esse nome.' })
  async criarModelo(@Body() corpo: DadosDoModeloDto): Promise<ModeloDto> {
    return modeloDto(await this.treinos.criarModelo(corpo));
  }

  @Put('modelos/:id')
  @RequirePermission('treinos:editar')
  @ApiOperation({ operationId: 'editarModeloDeTreino', summary: 'Edita um modelo de ficha.' })
  @ApiOkResponse({ type: ModeloDto })
  @ApiNotFoundResponse({ description: 'Modelo não encontrado.' })
  async editarModelo(
    @Param('id', uuid) id: string,
    @Body() corpo: DadosDoModeloDto,
  ): Promise<ModeloDto> {
    return modeloDto(await this.treinos.editarModelo(id, corpo));
  }

  @Post('modelos/:id/usar')
  @HttpCode(200)
  @RequirePermission('treinos:criar')
  @ApiOperation({
    operationId: 'usarModeloDeTreino',
    summary: '"Usar modelo": cria o rascunho da ficha do aluno com os treinos do modelo.',
  })
  @ApiOkResponse({ type: FichaDto })
  @ApiNotFoundResponse({ description: 'Modelo ou aluno não encontrado.' })
  async usarModelo(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
    @Body() corpo: UsarModeloDto,
  ): Promise<FichaDto> {
    return fichaDto(await this.treinos.usarModelo(executor(sessao), id, corpo.alunoId));
  }
}

/** O treino no app do aluno (T33): só a ficha ativa, o registro de execução e a evolução. */
@ApiTags('app')
@UseFilters(ErrosDosTreinosFilter)
@Controller('app/treino')
export class TreinoDoAppController {
  constructor(private readonly treinos: Treinos) {}

  @Get()
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'minhaFichaDeTreino',
    summary:
      'A ficha ativa do aluno da sessão. Rascunho e ficha aguardando aprovação não aparecem.',
  })
  @ApiOkResponse({ type: FichaDoAppDto })
  @ApiNotFoundResponse({ description: 'O aluno não tem ficha ativa.' })
  async minhaFicha(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<FichaDoAppDto> {
    const ficha = await this.treinos.fichaAtivaDoAluno(sessao.sujeitoId);
    if (!ficha) {
      throw new NaoEncontradoError('Ficha de treino');
    }
    return {
      id: ficha.id,
      nome: ficha.nome,
      objetivo: ficha.objetivo,
      nivel: ficha.nivel,
      frequenciaSemanal: ficha.frequenciaSemanal,
      divisao: ficha.divisao,
      validaAte: ficha.validaAte,
      treinos: ficha.treinos,
    };
  }

  @Post('execucoes')
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'registrarExecucaoDeTreino',
    summary: 'Registra um exercício feito: carga e esforço de 0 a 10.',
  })
  @ApiCreatedResponse({ type: ExecucaoDto })
  async registrar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: RegistrarExecucaoDto,
  ): Promise<ExecucaoDto> {
    const execucao = await this.treinos.registrarExecucao(sessao.sujeitoId, corpo);
    return {
      id: execucao.id,
      exercicio: execucao.exercicio,
      cargaKg: execucao.cargaKg,
      esforco: execucao.esforco,
      realizadoEm: execucao.realizadoEm.toISOString(),
    };
  }

  @Get('evolucao')
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'minhaEvolucaoDeTreino',
    summary: 'Evolução de carga e esforço do aluno da sessão (Desempenho).',
  })
  @ApiOkResponse({ type: AcompanhamentoDeTreinoDto })
  evolucao(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<AcompanhamentoDeTreinoDto> {
    return this.treinos.acompanhamento(sessao.sujeitoId);
  }
}
