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
import { CaixaDeAvisos, InscricoesDePush, PreferenciasDeAviso } from '../../application/caixa';
import { Comunicados } from '../../application/comunicados';
import type { Destinatario } from '../../domain/aviso';
import {
  CancelarInscricaoDto,
  ChavePublicaDoPushDto,
  ComunicadoDto,
  ConsultaDeAvisosDto,
  ContadorDeAvisosDto,
  DefinirPreferenciaDto,
  InscreverPushDto,
  PaginaDeAvisosDto,
  PreferenciaDeAvisoDto,
  ResultadoDoComunicadoDto,
} from './dto';
import { ErrosDosAvisosFilter } from './erros.filter';
import { avisoDto } from './mapeamento';

const doAluno = (sessao: ReivindicacoesDoAcesso): Destinatario => ({
  tipo: 'aluno',
  id: sessao.sujeitoId,
});
const uuid = new ParseUUIDPipe({ version: '4' });

/** A caixa de avisos do aluno no app (tela Avisos: "Todos" e "Não lidos"). */
@ApiTags('app')
@UseFilters(ErrosDosAvisosFilter)
@Controller('app/avisos')
export class AvisosDoAppController {
  constructor(
    private readonly caixa: CaixaDeAvisos,
    private readonly preferencias: PreferenciasDeAviso,
  ) {}

  @Get()
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'listarMeusAvisos',
    summary: 'Avisos do aluno, do mais novo ao mais antigo; só os não lidos com `naoLidos`.',
  })
  @ApiOkResponse({ type: PaginaDeAvisosDto })
  @ApiBadRequestResponse({ description: 'Cursor inválido.' })
  async listar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Query() consulta: ConsultaDeAvisosDto,
  ): Promise<PaginaDeAvisosDto> {
    const destinatario = doAluno(sessao);
    const [pagina, naoLidos] = await Promise.all([
      this.caixa.listar(destinatario, consulta),
      this.caixa.contarNaoLidos(destinatario),
    ]);
    return {
      itens: pagina.itens.map(avisoDto),
      proximoCursor: pagina.proximoCursor,
      naoLidos,
    };
  }

  @Get('contador')
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'contarMeusAvisosNaoLidos',
    summary: 'Quantos avisos não lidos o aluno tem (selo do app).',
  })
  @ApiOkResponse({ type: ContadorDeAvisosDto })
  async contador(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<ContadorDeAvisosDto> {
    return { naoLidos: await this.caixa.contarNaoLidos(doAluno(sessao)) };
  }

  @Post('lidos')
  @HttpCode(204)
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'marcarTodosOsAvisosComoLidos',
    summary: 'Marca todos os avisos do aluno como lidos.',
  })
  @ApiNoContentResponse()
  async marcarTodosComoLidos(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<void> {
    await this.caixa.marcarTodosComoLidos(doAluno(sessao));
  }

  @Post(':id/lido')
  @HttpCode(204)
  @Autenticado('aluno')
  @ApiOperation({ operationId: 'marcarAvisoComoLido', summary: 'Marca um aviso como lido.' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'O aviso não existe ou é de outro aluno.' })
  async marcarComoLido(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', uuid) id: string,
  ): Promise<void> {
    await this.caixa.marcarComoLido(doAluno(sessao), id);
  }

  @Get('preferencias')
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'listarMinhasPreferenciasDeAviso',
    summary: 'Preferência de push de cada tipo de aviso (ligado até o aluno desligar).',
  })
  @ApiOkResponse({ type: [PreferenciaDeAvisoDto] })
  listarPreferencias(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
  ): Promise<PreferenciaDeAvisoDto[]> {
    return this.preferencias.listar(doAluno(sessao));
  }

  @Put('preferencias')
  @HttpCode(204)
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'definirPreferenciaDeAviso',
    summary: 'Liga ou desliga o push de um tipo de aviso; o aviso continua na lista.',
  })
  @ApiNoContentResponse()
  async definirPreferencia(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: DefinirPreferenciaDto,
  ): Promise<void> {
    await this.preferencias.definir(doAluno(sessao), corpo.tipo, corpo.push);
  }
}

/** Dispositivos do aluno no Web Push (a inscrição no navegador e o service worker são do T32). */
@ApiTags('app')
@UseFilters(ErrosDosAvisosFilter)
@Controller('app/push')
export class PushDoAppController {
  constructor(private readonly inscricoes: InscricoesDePush) {}

  @Get('chave-publica')
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'obterChavePublicaDoPush',
    summary: 'Chave pública VAPID para `applicationServerKey` ao inscrever o navegador.',
  })
  @ApiOkResponse({ type: ChavePublicaDoPushDto })
  chavePublica(): ChavePublicaDoPushDto {
    return { chave: this.inscricoes.chavePublica() };
  }

  @Post('inscricoes')
  @HttpCode(204)
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'inscreverPush',
    summary: 'Inscreve o dispositivo no push; repetir o mesmo endpoint atualiza as chaves.',
  })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Endpoint que não é um endereço https público.' })
  async inscrever(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: InscreverPushDto,
  ): Promise<void> {
    await this.inscricoes.inscrever(doAluno(sessao), {
      endpoint: corpo.endpoint,
      p256dh: corpo.keys.p256dh,
      auth: corpo.keys.auth,
      dispositivo: corpo.dispositivo,
    });
  }

  @Delete('inscricoes')
  @HttpCode(204)
  @Autenticado('aluno')
  @ApiOperation({
    operationId: 'desinscreverPush',
    summary: 'Remove o dispositivo do push (sem erro se ele já não estava inscrito).',
  })
  @ApiNoContentResponse()
  async cancelar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: CancelarInscricaoDto,
  ): Promise<void> {
    await this.inscricoes.cancelar(doAluno(sessao), corpo.endpoint);
  }
}

/** Comunicado manual da academia; a tela de criar comunicado no painel não tem referência visual. */
@ApiTags('avisos')
@UseFilters(ErrosDosAvisosFilter)
@Controller('avisos/comunicados')
export class ComunicadosController {
  constructor(private readonly comunicados: Comunicados) {}

  @Post()
  @HttpCode(200)
  @RequirePermission('alunos:editar')
  @ApiOperation({
    operationId: 'enviarComunicado',
    summary: 'Envia um comunicado aos alunos (todos, ou só os de `alunoIds`), com push opcional.',
  })
  @ApiOkResponse({ type: ResultadoDoComunicadoDto })
  enviar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: ComunicadoDto,
  ): Promise<ResultadoDoComunicadoDto> {
    return this.comunicados.enviar({ usuarioId: sessao.sujeitoId }, corpo);
  }
}
