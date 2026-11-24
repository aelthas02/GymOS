import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseFilePipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
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
import { Relogio } from '../../../platform/domain/relogio';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
  permiteRecursosDeDesenvolvimento,
} from '../../../platform/infra/configuracao';
import { ContextoDoTenant } from '../../../platform/infra/contexto/contexto-do-tenant';
import { Publica } from '../../../platform/interface/http/acesso-publico';
import { Armazenamento } from '../../application/armazenamento';
import { ConexoesMeta } from '../../application/conexoes-meta';
import { LIMITE_MAXIMO_DO_UPLOAD } from '../../domain/armazenamento';
import { type CanalMeta, type ConexaoMeta, ehCanalMeta } from '../../domain/meta';
import { ObjetosDeArmazenamentoFake } from '../../infra/objetos.fake';
import { TransporteDeWhatsappFake } from '../../infra/whatsapp.fake';
import {
  ArquivoEnviadoDto,
  ConexaoMetaDto,
  IniciarConexaoDto,
  InicioDaConexaoDto,
  MensagemDeDevDto,
  RetornoDaMetaDto,
  UrlAssinadaDto,
} from './dto';
import { ErrosDasIntegracoesFilter } from './erros.filter';

const executor = (sessao: ReivindicacoesDoAcesso) => ({ usuarioId: sessao.sujeitoId });

function canalDaRota(valor: string): CanalMeta {
  if (!ehCanalMeta(valor)) {
    throw new NotFoundException('Canal não encontrado.');
  }
  return valor;
}

const conexaoDto = (conexao: ConexaoMeta): ConexaoMetaDto => ({
  canal: conexao.canal,
  estado: conexao.estado,
  contaNome: conexao.contaNome,
  expiraEm: conexao.expiraEm?.toISOString() ?? null,
  conectadoEm: conexao.conectadoEm?.toISOString() ?? null,
});

/**
 * Conexões da academia com a Meta (T13d). Fora do módulo Marketing: o WhatsApp também é da Recepção e
 * de Configurações. A permissão é a da seção "Redes sociais e WhatsApp" de Configurações.
 */
@ApiTags('integracoes')
@UseFilters(ErrosDasIntegracoesFilter)
@Controller('integracoes/meta')
export class ConexoesMetaController {
  constructor(private readonly conexoes: ConexoesMeta) {}

  @Get()
  @Autenticado('staff')
  @ApiOperation({
    operationId: 'listarConexoesMeta',
    summary: 'Estado de cada canal: Instagram, Facebook e WhatsApp.',
  })
  @ApiOkResponse({ type: [ConexaoMetaDto] })
  async listar(): Promise<ConexaoMetaDto[]> {
    return (await this.conexoes.estados()).map(conexaoDto);
  }

  @Post(':canal/conectar')
  @HttpCode(200)
  @RequirePermission('configuracoes.redes-sociais:editar')
  @ApiOperation({
    operationId: 'iniciarConexaoMeta',
    summary:
      'Abre o fluxo oficial (OAuth ou cadastro do WhatsApp Business). O WhatsApp passa a "Verificação pendente".',
  })
  @ApiOkResponse({ type: InicioDaConexaoDto })
  @ApiNotFoundResponse({ description: 'Canal desconhecido.' })
  async conectar(
    @Param('canal') canal: string,
    @Body() corpo: IniciarConexaoDto,
  ): Promise<InicioDaConexaoDto> {
    const inicio = await this.conexoes.iniciar(
      canalDaRota(canal),
      corpo.redirecionarPara ?? '/configuracoes',
    );
    return { conexao: conexaoDto(inicio.conexao), urlDoFluxo: inicio.urlDoFluxo };
  }

  @Post(':canal/retorno')
  @HttpCode(200)
  @RequirePermission('configuracoes.redes-sociais:editar')
  @ApiOperation({
    operationId: 'concluirRetornoDaMeta',
    summary: 'Recebe o código do fluxo oficial e guarda o token (cifrado) da conta.',
  })
  @ApiOkResponse({ type: ConexaoMetaDto })
  @ApiNotFoundResponse({ description: 'Canal desconhecido.' })
  async retorno(
    @Param('canal') canal: string,
    @Body() corpo: RetornoDaMetaDto,
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
  ): Promise<ConexaoMetaDto> {
    return conexaoDto(
      await this.conexoes.concluirPeloRetorno(
        canalDaRota(canal),
        corpo.codigo,
        corpo.state,
        executor(sessao),
      ),
    );
  }

  @Post(':canal/concluir')
  @HttpCode(200)
  @RequirePermission('configuracoes.redes-sociais:editar')
  @ApiOperation({
    operationId: 'concluirConexaoMeta',
    summary: '"Concluir conexão": confere com a Meta se a verificação pendente terminou.',
  })
  @ApiOkResponse({ type: ConexaoMetaDto })
  @ApiNotFoundResponse({ description: 'Canal desconhecido.' })
  async concluir(
    @Param('canal') canal: string,
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
  ): Promise<ConexaoMetaDto> {
    return conexaoDto(await this.conexoes.concluir(canalDaRota(canal), executor(sessao)));
  }

  @Delete(':canal')
  @RequirePermission('configuracoes.redes-sociais:editar')
  @ApiOperation({ operationId: 'desconectarMeta', summary: 'Desconecta o canal e apaga o token.' })
  @ApiOkResponse({ type: ConexaoMetaDto })
  @ApiNotFoundResponse({ description: 'Canal desconhecido.' })
  async desconectar(
    @Param('canal') canal: string,
    @SessaoAtual() sessao: ReivindicacoesDoAcesso,
  ): Promise<ConexaoMetaDto> {
    return conexaoDto(await this.conexoes.desconectar(canalDaRota(canal), executor(sessao)));
  }
}

interface ArquivoDoUpload {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/** Arquivos do tenant: upload validado e URLs assinadas de curta duração. */
@ApiTags('arquivos')
@UseFilters(ErrosDasIntegracoesFilter)
@Controller('arquivos')
export class ArquivosController {
  constructor(
    private readonly armazenamento: Armazenamento,
    private readonly objetos: ObjetosDeArmazenamentoFake,
    private readonly relogio: Relogio,
  ) {}

  @Post()
  @Autenticado()
  @UseInterceptors(
    FileInterceptor('arquivo', { limits: { fileSize: LIMITE_MAXIMO_DO_UPLOAD + 1 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['arquivo', 'pasta'],
      properties: {
        arquivo: { type: 'string', format: 'binary' },
        pasta: {
          type: 'string',
          example: 'treinos',
          description: 'Pasta lógica dentro do tenant.',
        },
      },
    },
  })
  @ApiOperation({
    operationId: 'enviarArquivo',
    summary: 'Envia um arquivo (JPEG, PNG, WebP, PDF ou MP4, com limite por tipo).',
  })
  @ApiCreatedResponse({ type: ArquivoEnviadoDto })
  async enviar(
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true })) arquivo: ArquivoDoUpload,
    @Body('pasta') pasta: string,
  ): Promise<ArquivoEnviadoDto> {
    return this.armazenamento.enviar({
      pasta: pasta ?? '',
      nome: arquivo.originalname,
      tipo: arquivo.mimetype,
      conteudo: arquivo.buffer,
    });
  }

  @Get('url')
  @Autenticado()
  @ApiOperation({
    operationId: 'urlAssinadaDoArquivo',
    summary: 'URL de leitura de curta duração para um arquivo do tenant.',
  })
  @ApiOkResponse({ type: UrlAssinadaDto })
  @ApiNotFoundResponse({ description: 'Arquivo de outra academia.' })
  async url(@Query('chave') chave: string): Promise<UrlAssinadaDto> {
    const { url, expiraEm } = await this.armazenamento.urlAssinada(chave ?? '');
    return { url, expiraEm: expiraEm.toISOString() };
  }

  @Delete()
  @HttpCode(204)
  @Autenticado()
  @ApiOperation({ operationId: 'removerArquivo', summary: 'Remove um arquivo do tenant.' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Arquivo de outra academia.' })
  async remover(@Query('chave') chave: string): Promise<void> {
    await this.armazenamento.remover(chave ?? '');
  }

  /** Só no armazenamento fake: o S3 serve as próprias URLs assinadas. */
  @Get('baixar')
  @Publica()
  @Header('cache-control', 'private, no-store')
  @ApiOperation({
    operationId: 'baixarArquivoAssinado',
    summary: 'Download pela URL assinada (adapter fake).',
  })
  baixar(
    @Query('chave') chave: string,
    @Query('expira') expira: string,
    @Query('assinatura') assinatura: string,
  ): StreamableFile {
    const objeto = this.objetos.abrir(
      chave ?? '',
      expira ?? '',
      assinatura ?? '',
      this.relogio.agora(),
    );
    if (!objeto) {
      throw new NotFoundException('Arquivo não encontrado.');
    }
    return new StreamableFile(objeto.conteudo, { type: objeto.tipo });
  }
}

/** Endpoint de dev do WhatsApp fake: lista as mensagens da academia atual. Fora de produção só. */
@ApiTags('integracoes')
@Controller('integracoes/dev')
export class IntegracoesDeDevController {
  constructor(
    private readonly whatsapp: TransporteDeWhatsappFake,
    private readonly contexto: ContextoDoTenant,
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly plataforma: ConfiguracaoDaPlataforma,
  ) {}

  @Get('mensagens')
  @Autenticado('staff')
  @ApiOperation({
    operationId: 'listarMensagensDoFake',
    summary: 'Mensagens de WhatsApp guardadas pelo adapter fake (somente fora de produção).',
  })
  @ApiOkResponse({ type: [MensagemDeDevDto] })
  mensagens(): MensagemDeDevDto[] {
    if (!permiteRecursosDeDesenvolvimento(this.plataforma)) {
      throw new NotFoundException();
    }
    return this.whatsapp
      .doTenant(this.contexto.tenant().id)
      .map(({ idExterno, telefone, texto }) => ({ idExterno, telefone, texto }));
  }
}
