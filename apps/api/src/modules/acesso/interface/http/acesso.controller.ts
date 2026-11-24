import { Body, Controller, Get, HttpCode, Post, Put, Query, UseFilters } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { VALIDADE_DO_QR_SEGUNDOS, rotuloDoMotivo } from '@gymos/shared-acesso';
import type { ReivindicacoesDoAcesso } from '../../../autenticacao/application/portas';
import {
  Autenticado,
  RequirePermission,
  SessaoAtual,
} from '../../../autenticacao/interface/http/decoradores';
import { type ResultadoDoRegistro, Acessos } from '../../application/acessos';
import { AlertasDeFrequencia } from '../../application/alertas';
import { ConfiguracoesDoAcesso, ConfiguracoesDosAlertas } from '../../application/configuracoes';
import { Frequencia } from '../../application/frequencia';
import { QrDeCheckin } from '../../application/qr';
import {
  AlunoEmRiscoDto,
  CheckInDto,
  CheckInPorQrDto,
  ChecksInDeHojeDto,
  ConfiguracaoDeAcessoDto,
  ConfiguracaoDosAlertasDto,
  ConsultaDeMesDto,
  ConsultaDeRiscoDto,
  ConsultaPorAlunoDto,
  FrequenciaPorHorarioDto,
  LiberacaoManualDto,
  PaginaDeAlunosEmRiscoDto,
  PaginaDeFrequenciaPorAlunoDto,
  PresencasDoMesDto,
  PreviaDosAlertasDto,
  QrDeCheckinDto,
  ResultadoDoAcessoDto,
} from './dto';
import { ErrosDoAcessoFilter } from './erros.filter';

const LIMITE_PADRAO = 50;

const resultadoDto = ({
  acesso,
  repetido,
  motivoTexto,
}: ResultadoDoRegistro): ResultadoDoAcessoDto => ({
  repetido,
  acesso: {
    id: acesso.id,
    idDeOrigem: acesso.idDeOrigem,
    alunoId: acesso.alunoId,
    metodo: acesso.metodo,
    direcao: acesso.direcao,
    resultado: acesso.resultado,
    motivo: acesso.motivo,
    motivoTexto: motivoTexto ?? (acesso.motivo ? rotuloDoMotivo(acesso.motivo) : null),
    modalidade: acesso.modalidade,
    registradoEm: acesso.registradoEm.toISOString(),
  },
});

/** Registro de acessos e leituras de frequência (tela Acesso e frequência, Início e Relatórios). */
@ApiTags('acesso')
@UseFilters(ErrosDoAcessoFilter)
@Controller('acesso')
export class AcessoController {
  constructor(
    private readonly acessos: Acessos,
    private readonly frequencia: Frequencia,
    private readonly alertas: AlertasDeFrequencia,
  ) {}

  @Post('check-in')
  @HttpCode(200)
  @RequirePermission('acesso:criar')
  @ApiOperation({
    operationId: 'registrarCheckInDaRecepcao',
    summary:
      'Check-in ou check-out registrado pela Recepção; as regras de acesso valem como na catraca.',
  })
  @ApiOkResponse({ type: ResultadoDoAcessoDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  async checkIn(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: CheckInDto,
  ): Promise<ResultadoDoAcessoDto> {
    return resultadoDto(
      await this.acessos.checkInDaRecepcao(
        { usuarioId: sessao.sujeitoId },
        {
          alunoId: corpo.alunoId,
          direcao: corpo.direcao ?? 'entrada',
          modalidade: corpo.modalidade,
          unidadeId: corpo.unidadeId,
          idDeOrigem: corpo.idDeOrigem,
        },
      ),
    );
  }

  @Post('check-in/qr')
  @HttpCode(200)
  @RequirePermission('acesso:criar')
  @ApiOperation({
    operationId: 'registrarCheckInPorQr',
    summary:
      'Confere o QR do app (assinatura, validade de 60 s e uso único) e registra o acesso; QR recusado vira acesso negado.',
  })
  @ApiOkResponse({ type: ResultadoDoAcessoDto })
  async checkInPorQr(@Body() corpo: CheckInPorQrDto): Promise<ResultadoDoAcessoDto> {
    const { token, ...pedido } = corpo;
    return resultadoDto(await this.acessos.registrarPorQr(token, pedido));
  }

  @Post('liberacao-manual')
  @HttpCode(200)
  @RequirePermission('acesso:criar')
  @ApiOperation({
    operationId: 'liberarAcessoManualmente',
    summary:
      'Libera a entrada do aluno apesar da regra que negaria. Exige o motivo e é auditada como sensível.',
  })
  @ApiOkResponse({ type: ResultadoDoAcessoDto })
  @ApiNotFoundResponse({ description: 'Aluno não encontrado.' })
  async liberarManualmente(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: LiberacaoManualDto,
  ): Promise<ResultadoDoAcessoDto> {
    return resultadoDto(
      await this.acessos.liberarManualmente({ usuarioId: sessao.sujeitoId }, corpo),
    );
  }

  @Get('frequencia/checkins-de-hoje')
  @RequirePermission('acesso:ver')
  @ApiOperation({
    operationId: 'obterCheckinsDeHoje',
    summary: 'Check-ins de hoje (entradas liberadas) e acessos negados.',
  })
  @ApiOkResponse({ type: ChecksInDeHojeDto })
  checkinsDeHoje(): Promise<ChecksInDeHojeDto> {
    return this.frequencia.checkinsDeHoje();
  }

  @Get('frequencia/por-horario')
  @RequirePermission('acesso:ver')
  @ApiOperation({
    operationId: 'obterFrequenciaPorHorario',
    summary: 'Entradas por hora: média por dia nos últimos 30 dias.',
  })
  @ApiOkResponse({ type: FrequenciaPorHorarioDto })
  frequenciaPorHorario(): Promise<FrequenciaPorHorarioDto> {
    return this.frequencia.frequenciaPorHorario();
  }

  @Get('frequencia/por-aluno')
  @RequirePermission('acesso:ver')
  @ApiOperation({
    operationId: 'listarFrequenciaPorAluno',
    summary: 'Treinos de cada aluno no mês, de quem mais treina a quem está em risco.',
  })
  @ApiOkResponse({ type: PaginaDeFrequenciaPorAlunoDto })
  @ApiBadRequestResponse({ description: 'Mês ou cursor inválido.' })
  frequenciaPorAluno(
    @Query() consulta: ConsultaPorAlunoDto,
  ): Promise<PaginaDeFrequenciaPorAlunoDto> {
    return this.frequencia.frequenciaPorAluno(consulta.mes, {
      limite: consulta.limite ?? LIMITE_PADRAO,
      cursor: consulta.cursor,
    });
  }

  @Get('frequencia/presencas-do-mes')
  @RequirePermission('acesso:ver')
  @ApiOperation({
    operationId: 'obterPresencasDoMes',
    summary:
      'Presenças (aluno-dia com entrada liberada) por aluno no mês, para o rateio de receita.',
  })
  @ApiOkResponse({ type: PresencasDoMesDto })
  presencasDoMes(@Query() consulta: ConsultaDeMesDto): Promise<PresencasDoMesDto> {
    return this.frequencia.presencasDoMes(consulta.mes);
  }

  @Get('frequencia/alunos-em-risco')
  @RequirePermission('acesso:ver')
  @ApiOperation({
    operationId: 'listarAlunosEmRisco',
    summary: 'Alunos com alerta de frequência aberto, urgentes primeiro.',
  })
  @ApiOkResponse({ type: PaginaDeAlunosEmRiscoDto })
  async alunosEmRisco(@Query() consulta: ConsultaDeRiscoDto): Promise<PaginaDeAlunosEmRiscoDto> {
    const pagina = await this.alertas.emRisco({
      nivel: consulta.nivel,
      professorId: consulta.professorId,
      limite: consulta.limite ?? LIMITE_PADRAO,
      cursor: consulta.cursor,
    });
    return {
      ...pagina,
      destinatarios: [...pagina.destinatarios],
      itens: pagina.itens.map((item): AlunoEmRiscoDto => ({
        ...item,
        desde: item.desde.toISOString(),
      })),
    };
  }
}

/** QR de check-in do aluno logado no app. */
@ApiTags('app')
@UseFilters(ErrosDoAcessoFilter)
@Controller('app/acesso')
export class AcessoDoAppController {
  constructor(private readonly qr: QrDeCheckin) {}

  @Post('qr')
  @HttpCode(200)
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'emitirMeuQrDeCheckin',
    summary: 'Emite o QR de check-in: assinado, vale 60 s e só pode ser usado uma vez.',
  })
  @ApiOkResponse({ type: QrDeCheckinDto })
  async emitir(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<QrDeCheckinDto> {
    const emitido = await this.qr.emitir(sessao.sujeitoId);
    return {
      token: emitido.token,
      expiraEm: emitido.expiraEm.toISOString(),
      validadeSegundos: VALIDADE_DO_QR_SEGUNDOS,
    };
  }
}

/** Regras de acesso e alertas de frequência, nas seções de Configurações. */
@ApiTags('configuracoes')
@UseFilters(ErrosDoAcessoFilter)
@Controller('configuracoes')
export class ConfiguracoesDoAcessoController {
  constructor(
    private readonly regras: ConfiguracoesDoAcesso,
    private readonly alertas: ConfiguracoesDosAlertas,
    private readonly apuracao: AlertasDeFrequencia,
  ) {}

  @Get('acesso')
  @RequirePermission('configuracoes.catraca:ver')
  @ApiOperation({
    operationId: 'obterRegrasDeAcesso',
    summary: 'Regras de acesso: bloqueio por atraso, horário, limite por dia e anti-passback.',
  })
  @ApiOkResponse({ type: ConfiguracaoDeAcessoDto })
  obterRegras(): Promise<ConfiguracaoDeAcessoDto> {
    return this.regras.obter();
  }

  @Put('acesso')
  @RequirePermission('configuracoes.catraca:editar')
  @ApiOperation({ operationId: 'salvarRegrasDeAcesso', summary: 'Salva as regras de acesso.' })
  @ApiOkResponse({ type: ConfiguracaoDeAcessoDto })
  @ApiBadRequestResponse({ description: 'Valores fora dos limites.' })
  salvarRegras(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: ConfiguracaoDeAcessoDto,
  ): Promise<ConfiguracaoDeAcessoDto> {
    return this.regras.salvar(
      { usuarioId: sessao.sujeitoId },
      {
        bloqueioPorAtrasoDias: corpo.bloqueioPorAtrasoDias ?? null,
        abertura: corpo.abertura,
        fechamento: corpo.fechamento,
        limitePorDia: corpo.limitePorDia ?? null,
        antiPassback: corpo.antiPassback,
      },
    );
  }

  @Get('alertas')
  @RequirePermission('configuracoes.alertas:ver')
  @ApiOperation({
    operationId: 'obterAlertasDeFrequencia',
    summary: 'Configuração dos alertas de frequência.',
  })
  @ApiOkResponse({ type: ConfiguracaoDosAlertasDto })
  obterAlertas(): Promise<ConfiguracaoDosAlertasDto> {
    return this.alertas.obter().then((config) => ({
      ...config,
      destinatarios: [...config.destinatarios],
    }));
  }

  @Put('alertas')
  @RequirePermission('configuracoes.alertas:editar')
  @ApiOperation({
    operationId: 'salvarAlertasDeFrequencia',
    summary: 'Salva a configuração dos alertas de frequência.',
  })
  @ApiOkResponse({ type: ConfiguracaoDosAlertasDto })
  @ApiBadRequestResponse({ description: 'Valores fora dos limites.' })
  async salvarAlertas(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: ConfiguracaoDosAlertasDto,
  ): Promise<ConfiguracaoDosAlertasDto> {
    const salva = await this.alertas.salvar({ usuarioId: sessao.sujeitoId }, corpo);
    return { ...salva, destinatarios: [...salva.destinatarios] };
  }

  @Get('alertas/previa')
  @RequirePermission('configuracoes.alertas:ver')
  @ApiOperation({
    operationId: 'obterPreviaDosAlertas',
    summary: 'Com a regra salva, quantos alunos seriam alertados hoje (urgentes e comuns).',
  })
  @ApiOkResponse({ type: PreviaDosAlertasDto })
  previa(): Promise<PreviaDosAlertasDto> {
    return this.apuracao.previa();
  }
}
