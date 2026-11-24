import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Sse,
  UseFilters,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Observable, Subject, finalize, interval, map, merge } from 'rxjs';
import { ErrosDoAcessoFilter } from '../../../acesso/interface/http/erros.filter';
import type { ReivindicacoesDoAcesso } from '../../../autenticacao/application/portas';
import { RequirePermission, SessaoAtual } from '../../../autenticacao/interface/http/decoradores';
import { SemTransacao } from '../../../platform/interface/http/sem-transacao';
import { AoVivo } from '../../application/ao-vivo';
import { CadastrosBiometricos } from '../../application/biometria';
import { ComandosDoAgente, type ResultadoDoTeste } from '../../application/comandos';
import {
  type AlertaDeDispositivo,
  type DispositivoComEstado,
  Dispositivos,
} from '../../application/dispositivos';
import { Pareamento } from '../../application/pareamento';
import type { CadastroBiometrico } from '../../application/portas';
import {
  AgenteDto,
  AlertaDeDispositivoDto,
  CadastroBiometricoDto,
  CadastroBiometricoEntradaDto,
  CodigoDePareamentoDto,
  DispositivoDto,
  DispositivoEntradaDto,
  ListaDeAgentesDto,
  ListaDeAlertasDeDispositivoDto,
  ListaDeCadastrosBiometricosDto,
  ListaDeDispositivosDto,
  ResultadoDoTesteDto,
  TesteDeConexaoDto,
} from './dto';
import { ErrosDosDispositivosFilter } from './erros.filter';

const iso = (data: Date | null): string | null => data?.toISOString() ?? null;

const dispositivoDto = (d: DispositivoComEstado): DispositivoDto => ({
  id: d.id,
  nome: d.nome,
  tipo: d.tipo,
  local: d.local,
  metodos: d.metodos,
  unidadeId: d.unidadeId,
  agenteId: d.agenteId,
  online: d.statusOnline,
  ultimoBatimentoEm: iso(d.ultimoBatimentoEm),
});

const alertaDto = (a: AlertaDeDispositivo): AlertaDeDispositivoDto => ({
  id: a.id,
  dispositivoId: a.dispositivoId,
  nome: a.nome,
  desde: a.desde.toISOString(),
  voltouEm: iso(a.voltouEm),
  aberto: a.aberto,
  duracaoEmSegundos: a.duracaoEmSegundos,
  texto: a.texto,
});

const entrada = (corpo: DispositivoEntradaDto) => ({
  nome: corpo.nome.trim(),
  tipo: corpo.tipo,
  local: corpo.local.trim(),
  metodos: [...new Set(corpo.metodos)],
  unidadeId: corpo.unidadeId ?? null,
  agenteId: corpo.agenteId ?? null,
});

const testeDto = (resultado: ResultadoDoTeste): ResultadoDoTesteDto => ({ ...resultado });

/** Catracas e leitores da aba Catraca: cadastro, status, Testar conexão e alertas de queda. */
@ApiTags('dispositivos')
@UseFilters(ErrosDosDispositivosFilter)
@Controller('dispositivos')
export class DispositivosController {
  constructor(
    private readonly dispositivos: Dispositivos,
    private readonly comandos: ComandosDoAgente,
  ) {}

  @Get()
  @RequirePermission('configuracoes.catraca:ver')
  @ApiOperation({
    operationId: 'listarDispositivos',
    summary: 'Catracas e leitores com status online ou offline pelo último batimento.',
  })
  @ApiOkResponse({ type: ListaDeDispositivosDto })
  async listar(): Promise<ListaDeDispositivosDto> {
    return { itens: (await this.dispositivos.listar()).map(dispositivoDto) };
  }

  @Get('alertas')
  @RequirePermission('acesso:ver')
  @ApiOperation({
    operationId: 'listarAlertasDeDispositivo',
    summary:
      'Quedas abertas e das últimas 24 h ("Catraca 2 ficou 4 minutos sem resposta às 07:12 e já voltou").',
  })
  @ApiOkResponse({ type: ListaDeAlertasDeDispositivoDto })
  async alertas(): Promise<ListaDeAlertasDeDispositivoDto> {
    return { itens: (await this.dispositivos.alertas()).map(alertaDto) };
  }

  @Post()
  @RequirePermission('configuracoes.catraca:criar')
  @ApiOperation({ operationId: 'cadastrarDispositivo', summary: 'Cadastra uma catraca ou leitor.' })
  @ApiCreatedResponse({ type: DispositivoDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  async cadastrar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: DispositivoEntradaDto,
  ): Promise<DispositivoDto> {
    return dispositivoDto(
      await this.dispositivos.cadastrar({ usuarioId: sessao.sujeitoId }, entrada(corpo)),
    );
  }

  @Get(':id')
  @RequirePermission('configuracoes.catraca:ver')
  @ApiOperation({ operationId: 'obterDispositivo', summary: 'Um dispositivo com o seu status.' })
  @ApiOkResponse({ type: DispositivoDto })
  @ApiNotFoundResponse({ description: 'Dispositivo não encontrado.' })
  async obter(@Param('id', ParseUUIDPipe) id: string): Promise<DispositivoDto> {
    return dispositivoDto(await this.dispositivos.obter(id));
  }

  @Put(':id')
  @RequirePermission('configuracoes.catraca:editar')
  @ApiOperation({ operationId: 'editarDispositivo', summary: 'Edita um dispositivo.' })
  @ApiOkResponse({ type: DispositivoDto })
  @ApiNotFoundResponse({ description: 'Dispositivo não encontrado.' })
  async editar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() corpo: DispositivoEntradaDto,
  ): Promise<DispositivoDto> {
    return dispositivoDto(
      await this.dispositivos.editar({ usuarioId: sessao.sujeitoId }, id, entrada(corpo)),
    );
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('configuracoes.catraca:excluir')
  @ApiOperation({
    operationId: 'excluirDispositivo',
    summary: 'Exclui um dispositivo e as quedas dele.',
  })
  @ApiNoContentResponse({ description: 'Excluído.' })
  @ApiNotFoundResponse({ description: 'Dispositivo não encontrado.' })
  async excluir(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.dispositivos.excluir({ usuarioId: sessao.sujeitoId }, id);
  }

  @Get(':id/quedas')
  @RequirePermission('configuracoes.catraca:ver')
  @ApiOperation({
    operationId: 'listarQuedasDoDispositivo',
    summary: 'Histórico de quedas do dispositivo (as 100 mais recentes).',
  })
  @ApiOkResponse({ type: ListaDeAlertasDeDispositivoDto })
  @ApiNotFoundResponse({ description: 'Dispositivo não encontrado.' })
  async quedas(@Param('id', ParseUUIDPipe) id: string): Promise<ListaDeAlertasDeDispositivoDto> {
    return { itens: (await this.dispositivos.historicoDeQuedas(id)).map(alertaDto) };
  }

  @Post(':id/testes')
  @HttpCode(202)
  @RequirePermission('configuracoes.catraca:editar')
  @ApiOperation({
    operationId: 'testarConexaoDoDispositivo',
    summary:
      'Testar conexão: envia um ping ao agente do dispositivo. O agente responde no próximo batimento; consulte o resultado pelo id.',
  })
  @ApiResponse({ status: 202, type: TesteDeConexaoDto })
  @ApiBadRequestResponse({ description: 'Dispositivo sem agente pareado.' })
  testar(@Param('id', ParseUUIDPipe) id: string): Promise<TesteDeConexaoDto> {
    return this.comandos.testarConexao({ dispositivoId: id });
  }
}

/** Agente local da catraca: código de pareamento (Passo 4 e Configurações), status, revogação e teste. */
@ApiTags('dispositivos')
@UseFilters(ErrosDosDispositivosFilter)
@Controller('agentes-da-catraca')
export class AgentesDaCatracaController {
  constructor(
    private readonly pareamento: Pareamento,
    private readonly comandos: ComandosDoAgente,
  ) {}

  @Post('codigos')
  @RequirePermission('configuracoes.catraca:criar')
  @ApiOperation({
    operationId: 'gerarCodigoDePareamento',
    summary:
      'Gera o código de pareamento de 6 caracteres (vale 30 minutos e uma troca); o anterior não usado deixa de valer.',
  })
  @ApiCreatedResponse({ type: CodigoDePareamentoDto })
  async gerarCodigo(@SessaoAtual() sessao: ReivindicacoesDoAcesso): Promise<CodigoDePareamentoDto> {
    const gerado = await this.pareamento.gerarCodigo({ usuarioId: sessao.sujeitoId });
    return { ...gerado, expiraEm: gerado.expiraEm.toISOString() };
  }

  @Get()
  @RequirePermission('configuracoes.catraca:ver')
  @ApiOperation({
    operationId: 'listarAgentesDaCatraca',
    summary: 'Agentes pareados, com status e a última sincronização.',
  })
  @ApiOkResponse({ type: ListaDeAgentesDto })
  async listar(): Promise<ListaDeAgentesDto> {
    const agentes = await this.pareamento.listar();
    return {
      itens: agentes.map(({ agente, online }): AgenteDto => ({
        id: agente.id,
        nome: agente.nome,
        online,
        versaoDoAgente: agente.versaoDoAgente,
        ultimoBatimentoEm: iso(agente.ultimoBatimentoEm),
        ultimaSincronizacaoEm: iso(agente.ultimaSincronizacaoEm),
        revogadoEm: iso(agente.revogadoEm),
        pareadoEm: agente.criadoEm.toISOString(),
      })),
    };
  }

  @Post(':id/revogar')
  @HttpCode(204)
  @RequirePermission('configuracoes.catraca:editar')
  @ApiOperation({
    operationId: 'revogarAgenteDaCatraca',
    summary:
      'Revoga a credencial do agente: ele não envia mais acessos. Pareie de novo para reativar.',
  })
  @ApiNoContentResponse({ description: 'Revogado.' })
  @ApiNotFoundResponse({ description: 'Agente não encontrado.' })
  async revogar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.pareamento.revogar({ usuarioId: sessao.sujeitoId }, id);
  }

  @Post(':id/testes')
  @HttpCode(202)
  @RequirePermission('configuracoes.catraca:editar')
  @ApiOperation({
    operationId: 'testarConexaoDoAgente',
    summary:
      'Testar conexão (Passo 4): envia um ping ao agente. Consulte o resultado pelo id até "ok", "falhou" ou "expirou".',
  })
  @ApiResponse({ status: 202, type: TesteDeConexaoDto })
  testar(@Param('id', ParseUUIDPipe) id: string): Promise<TesteDeConexaoDto> {
    return this.comandos.testarConexao({ agenteId: id });
  }

  @Get('testes/:comandoId')
  @RequirePermission('configuracoes.catraca:ver')
  @ApiOperation({
    operationId: 'obterResultadoDoTesteDeConexao',
    summary:
      'Resultado do Testar conexão: aguardando, ok (com a latência), falhou ou expirou (60 s).',
  })
  @ApiOkResponse({ type: ResultadoDoTesteDto })
  @ApiNotFoundResponse({ description: 'Teste não encontrado.' })
  async resultado(
    @Param('comandoId', ParseUUIDPipe) comandoId: string,
  ): Promise<ResultadoDoTesteDto> {
    return testeDto(await this.comandos.resultadoDoTeste(comandoId));
  }
}

const cadastroDto = (c: CadastroBiometrico): CadastroBiometricoDto => ({
  alunoId: c.alunoId,
  tipo: c.tipo,
  dispositivoId: c.dispositivoId,
  status: c.status,
  atualizadoEm: c.atualizadoEm.toISOString(),
});

/** Cadastro de face e biometria: o servidor guarda a referência e o consentimento, o agente repassa. */
@ApiTags('acesso')
@UseFilters(ErrosDosDispositivosFilter, ErrosDoAcessoFilter)
@Controller('acesso/cadastros-biometricos')
export class CadastrosBiometricosController {
  constructor(private readonly biometrias: CadastrosBiometricos) {}

  @Post()
  @HttpCode(202)
  @RequirePermission('acesso:criar')
  @ApiOperation({
    operationId: 'solicitarCadastroBiometrico',
    summary:
      'Pede o cadastro de face ou digital do aluno no equipamento. Exige o consentimento de biometria; o template não passa pelo servidor.',
  })
  @ApiResponse({ status: 202, type: CadastroBiometricoDto })
  @ApiUnprocessableEntityResponse({ description: 'O aluno não deu o consentimento de biometria.' })
  @ApiNotFoundResponse({ description: 'Aluno ou dispositivo não encontrado.' })
  async solicitar(
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
    @Body() corpo: CadastroBiometricoEntradaDto,
  ): Promise<CadastroBiometricoDto> {
    return cadastroDto(await this.biometrias.solicitar({ usuarioId: sessao.sujeitoId }, corpo));
  }

  @Get(':alunoId')
  @RequirePermission('acesso:ver')
  @ApiOperation({
    operationId: 'listarCadastrosBiometricosDoAluno',
    summary: 'Face e biometria cadastradas do aluno (só o status, nunca o template).',
  })
  @ApiOkResponse({ type: ListaDeCadastrosBiometricosDto })
  async doAluno(
    @Param('alunoId', ParseUUIDPipe) alunoId: string,
  ): Promise<ListaDeCadastrosBiometricosDto> {
    return { itens: (await this.biometrias.doAluno(alunoId)).map(cadastroDto) };
  }
}

const PING_DO_SSE_MS = 25_000;

/** Tempo real de "Acessos de agora", da Recepção e dos alertas (SSE por tenant). */
@ApiTags('acesso')
@Controller('acesso/ao-vivo')
export class AoVivoController {
  constructor(private readonly aoVivo: AoVivo) {}

  @Sse('stream')
  @SemTransacao()
  @RequirePermission('acesso:ver')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    operationId: 'acompanharAcessosAoVivo',
    summary:
      'SSE do tenant: cada acesso registrado (`tipo: acesso`) e cada queda ou volta de dispositivo (`tipo: dispositivo`). Autentica com o Bearer, então o cliente usa fetch com stream, não EventSource. Um evento `ping` a cada 25 s mantém a conexão.',
  })
  @ApiOkResponse({ description: 'Fluxo text/event-stream.' })
  async stream(): Promise<Observable<MessageEvent>> {
    const mensagens = new Subject<MessageEvent>();
    const cancelar = await this.aoVivo.assinar((mensagem) => mensagens.next({ data: mensagem }));
    const pings = interval(PING_DO_SSE_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: {} })),
    );
    return merge(mensagens, pings).pipe(finalize(() => void cancelar()));
  }
}
