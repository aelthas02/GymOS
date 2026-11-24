import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Acessos } from '../../../acesso/application/acessos';
import { QrDeCheckin } from '../../../acesso/application/qr';
import {
  ChavesPublicasDoQrDto,
  ResultadoDaSincronizacaoDto,
  SincronizarAcessosDto,
} from '../../../acesso/interface/http/dto';
import { ErrosDoAcessoFilter } from '../../../acesso/interface/http/erros.filter';
import { Publica } from '../../../platform/interface/http/acesso-publico';
import {
  CacheDeAutorizacao,
  LIMITE_PADRAO_DA_SINCRONIZACAO,
} from '../../application/cache-de-acesso';
import { ComandosDoAgente } from '../../application/comandos';
import { Dispositivos } from '../../application/dispositivos';
import { Pareamento } from '../../application/pareamento';
import type { AgenteDaCatraca } from '../../application/portas';
import { AgenteAtual, AgenteGuard } from './agente.guard';
import {
  BatimentoDto,
  CredencialDoAgenteDto,
  ConsultaDoCacheDto,
  ListaDeDispositivosDoAgenteDto,
  PaginaDoCacheDto,
  ResultadoDoBatimentoDto,
  RespostaDeComandoDto,
  TrocaDeCodigoDto,
} from './dto';
import { ErrosDosDispositivosFilter } from './erros.filter';

/** Troca do código de pareamento pela credencial: o único endpoint do agente sem credencial. */
@ApiTags('agente')
@UseFilters(ErrosDosDispositivosFilter)
@Controller('agente')
export class PareamentoDoAgenteController {
  constructor(private readonly pareamento: Pareamento) {}

  @Post('pareamento')
  @HttpCode(200)
  @Publica()
  @ApiOperation({
    operationId: 'parearAgenteDaCatraca',
    summary:
      'O agente troca o código de pareamento (vale 30 minutos e uma troca) pela credencial própria, mostrada uma vez.',
  })
  @ApiOkResponse({ type: CredencialDoAgenteDto })
  @ApiBadRequestResponse({ description: 'Código inválido, vencido ou já usado.' })
  trocar(@Body() corpo: TrocaDeCodigoDto): Promise<CredencialDoAgenteDto> {
    return this.pareamento.trocarCodigo(corpo.codigo, { nome: corpo.nome, versao: corpo.versao });
  }
}

/**
 * API do agente da catraca (T23b, ADR-016): autenticada pela credencial do agente, não pela sessão do
 * painel. Contrato usado pelo T24a: baixar alunos autorizados, regras e chave pública do QR; enviar o
 * lote de acessos (com id de origem) e o batimento; responder aos comandos.
 */
@ApiTags('agente')
@ApiUnauthorizedResponse({ description: 'Credencial ausente, inválida ou revogada.' })
@UseFilters(ErrosDosDispositivosFilter, ErrosDoAcessoFilter)
@Publica()
@UseGuards(AgenteGuard)
@Controller('agente')
export class AgenteController {
  constructor(
    private readonly pareamento: Pareamento,
    private readonly dispositivos: Dispositivos,
    private readonly cache: CacheDeAutorizacao,
    private readonly acessos: Acessos,
    private readonly qr: QrDeCheckin,
    private readonly comandos: ComandosDoAgente,
  ) {}

  @Post('batimento')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'enviarBatimentoDoAgente',
    summary:
      'Batimento a cada 30 s: mantém os dispositivos online e devolve os comandos pendentes e a versão do cache de autorização.',
  })
  @ApiOkResponse({ type: ResultadoDoBatimentoDto })
  async batimento(
    @AgenteAtual() agente: AgenteDaCatraca,
    @Body() corpo: BatimentoDto,
  ): Promise<ResultadoDoBatimentoDto> {
    const resultado = await this.dispositivos.registrarBatimento(agente, corpo);
    return { ...resultado, recebidoEm: resultado.recebidoEm.toISOString() };
  }

  @Get('dispositivos')
  @ApiOperation({
    operationId: 'listarDispositivosDoAgente',
    summary: 'Catracas e leitores que o agente controla ou pode adotar (ainda sem agente).',
  })
  @ApiOkResponse({ type: ListaDeDispositivosDoAgenteDto })
  async dispositivosDoAgente(
    @AgenteAtual() agente: AgenteDaCatraca,
  ): Promise<ListaDeDispositivosDoAgenteDto> {
    const lista = await this.dispositivos.doAgente(agente);
    return {
      itens: lista.map(({ id, nome, tipo, local, metodos, unidadeId }) => ({
        id,
        nome,
        tipo,
        local,
        metodos,
        unidadeId,
      })),
    };
  }

  @Get('alunos-autorizados')
  @ApiOperation({
    operationId: 'baixarAlunosAutorizados',
    summary:
      'Cache de autorização com versão: alunos com contrato, atraso e plano mais as regras. Sem `desde` é a carga completa; com `desde`, só o que mudou. Repita com a `versao` devolvida enquanto `maisPaginas`.',
  })
  @ApiOkResponse({ type: PaginaDoCacheDto })
  obterCache(@Query() consulta: ConsultaDoCacheDto): Promise<PaginaDoCacheDto> {
    return this.cache.obter(consulta.desde, consulta.limite ?? LIMITE_PADRAO_DA_SINCRONIZACAO);
  }

  @Get('chaves-publicas')
  @ApiOperation({
    operationId: 'listarChavesPublicasDoQr',
    summary: 'Chaves públicas do QR para o agente conferir a assinatura offline.',
  })
  @ApiOkResponse({ type: ChavesPublicasDoQrDto })
  async chavesPublicas(): Promise<ChavesPublicasDoQrDto> {
    return { chaves: await this.qr.chavesPublicas() };
  }

  @Post('acessos')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'sincronizarAcessosOffline',
    summary:
      'Lote de acessos guardados offline: fora de ordem e repetidos são gravados uma vez cada (id de origem), na ordem do horário de origem.',
  })
  @ApiOkResponse({ type: ResultadoDaSincronizacaoDto })
  async sincronizar(
    @AgenteAtual() agente: AgenteDaCatraca,
    @Body() corpo: SincronizarAcessosDto,
  ): Promise<ResultadoDaSincronizacaoDto> {
    const resultado = await this.acessos.sincronizar(corpo.registros, corpo.unidadeId);
    await this.dispositivos.registrarSincronizacao(agente);
    return resultado;
  }

  @Post('comandos/:id/resposta')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'responderComandoDoAgente',
    summary: 'Resposta a um comando recebido no batimento (ping, cadastro ou remoção biométrica).',
  })
  @ApiNotFoundResponse({ description: 'Comando desconhecido, de outro agente ou expirado.' })
  async responder(
    @AgenteAtual() agente: AgenteDaCatraca,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() corpo: RespostaDeComandoDto,
  ): Promise<void> {
    await this.comandos.responder(agente, id, corpo);
  }

  @Post('credencial/rotacionar')
  @HttpCode(200)
  @ApiOperation({
    operationId: 'rotacionarCredencialDoAgente',
    summary: 'Troca a credencial por uma nova; a antiga deixa de valer na hora.',
  })
  @ApiOkResponse({ type: CredencialDoAgenteDto })
  rotacionar(@AgenteAtual() agente: AgenteDaCatraca): Promise<CredencialDoAgenteDto> {
    return this.pareamento.rotacionar(agente);
  }
}
