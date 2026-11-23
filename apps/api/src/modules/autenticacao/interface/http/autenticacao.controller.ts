import {
  Body,
  ConflictException,
  Controller,
  GoneException,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ContextoDoTenant } from '../../../platform/infra/contexto/contexto-do-tenant';
import { Publica } from '../../../platform/interface/http/acesso-publico';
import { AceitarConvite } from '../../application/convites';
import {
  EntrarComoAluno,
  EntrarComoEquipe,
  PrimeiroAcessoDoAluno,
  type ResultadoDaEntrada,
  type Tentativa,
} from '../../application/entrada';
import { RedefinirSenha, SolicitarRedefinicaoDeSenha } from '../../application/senhas';
import { type SessaoAberta, Sessoes } from '../../application/sessoes';
import type { Publico } from '../../domain/credenciais';
import { apagarRefresh, exigirMesmaOrigem, gravarRefresh, lerRefresh } from './cookies';
import {
  AceitarConviteDto,
  EntrarNoAppDto,
  EntrarNoPainelDto,
  EsqueciSenhaDoAppDto,
  EsqueciSenhaDoPainelDto,
  PrimeiroAcessoDto,
  RedefinirSenhaDto,
  SessaoDto,
} from './dto';

export const CREDENCIAIS_INVALIDAS = 'E-mail, CPF ou senha incorretos.';
export const MUITAS_TENTATIVAS = 'Muitas tentativas erradas. Tente de novo em alguns minutos.';
const SESSAO_ENCERRADA = 'Sessão encerrada. Entre de novo.';

function responder(res: Response, publico: Publico, sessao: SessaoAberta): SessaoDto {
  gravarRefresh(res, publico, sessao);
  return { accessToken: sessao.accessToken, expiraEm: sessao.expiraEm.toISOString() };
}

/** Login com resultado: inválido 401, bloqueado 429 (o limite fica no Redis, nada a desfazer). */
function sessaoDaEntrada(
  res: Response,
  publico: Publico,
  resultado: ResultadoDaEntrada,
): SessaoDto {
  if (resultado.tipo === 'bloqueado') {
    throw new HttpException(MUITAS_TENTATIVAS, HttpStatus.TOO_MANY_REQUESTS);
  }
  if (resultado.tipo === 'invalido') {
    throw new UnauthorizedException(CREDENCIAIS_INVALIDAS);
  }
  return responder(res, publico, resultado.sessao);
}

/** Renovação e saída comuns aos dois apps; cada um só lê o próprio cookie. */
abstract class SessaoDoApp {
  protected abstract readonly publico: Publico;

  constructor(
    protected readonly contexto: ContextoDoTenant,
    private readonly sessoes: Sessoes,
    private readonly solicitar: SolicitarRedefinicaoDeSenha,
    private readonly redefinir: RedefinirSenha,
  ) {}

  protected tentativa(req: Request): Tentativa {
    return {
      tenantId: this.contexto.tenant().id,
      ip: req.ip ?? req.socket.remoteAddress ?? 'desconhecido',
    };
  }

  /**
   * Refresh recusado devolve 401 sem lançar: a revogação da família por reuso precisa do commit da
   * transação da requisição.
   */
  protected async renovarSessao(req: Request, res: Response): Promise<SessaoDto | object> {
    exigirMesmaOrigem(req);
    const token = lerRefresh(req, this.publico);
    const resultado = token
      ? await this.sessoes.renovar(this.publico, this.contexto.tenant().id, token)
      : ({ tipo: 'recusado' } as const);
    if (resultado.tipo === 'ok') {
      return responder(res, this.publico, resultado.sessao);
    }
    apagarRefresh(res, this.publico);
    res.status(HttpStatus.UNAUTHORIZED);
    return { statusCode: HttpStatus.UNAUTHORIZED, message: SESSAO_ENCERRADA };
  }

  protected async encerrarSessao(req: Request, res: Response): Promise<void> {
    exigirMesmaOrigem(req);
    const token = lerRefresh(req, this.publico);
    if (token) {
      await this.sessoes.encerrar(this.publico, token);
    }
    apagarRefresh(res, this.publico);
  }

  protected solicitarRedefinicao(identificador: string): Promise<void> {
    return this.solicitar.executar(this.contexto.tenant(), this.publico, identificador);
  }

  protected async redefinirSenha(dados: RedefinirSenhaDto): Promise<void> {
    if ((await this.redefinir.executar(this.publico, dados)) !== 'ok') {
      throw new GoneException('Link de redefinição expirado ou já usado.');
    }
  }
}

@ApiTags('autenticacao')
@Publica()
@Controller('auth/staff')
export class AutenticacaoDaEquipeController extends SessaoDoApp {
  protected readonly publico = 'staff';

  constructor(
    contexto: ContextoDoTenant,
    sessoes: Sessoes,
    solicitar: SolicitarRedefinicaoDeSenha,
    redefinir: RedefinirSenha,
    private readonly entrar: EntrarComoEquipe,
    private readonly aceitarConvite: AceitarConvite,
  ) {
    super(contexto, sessoes, solicitar, redefinir);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'entrarNoPainel', summary: 'Login da equipe (e-mail e senha).' })
  @ApiOkResponse({ type: SessaoDto, description: 'Grava o cookie gymos_rt_staff.' })
  @ApiUnauthorizedResponse({ description: CREDENCIAIS_INVALIDAS })
  @ApiTooManyRequestsResponse({ description: MUITAS_TENTATIVAS })
  async login(
    @Body() corpo: EntrarNoPainelDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoDto> {
    return sessaoDaEntrada(
      res,
      this.publico,
      await this.entrar.executar(this.tentativa(req), corpo),
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'renovarSessaoDoPainel',
    summary: 'Troca o refresh do cookie por um novo par (rotativo; reuso revoga a família).',
  })
  @ApiOkResponse({ type: SessaoDto })
  @ApiUnauthorizedResponse({ description: SESSAO_ENCERRADA })
  @ApiForbiddenResponse({ description: 'Sem o cabeçalho x-gymos-csrf ou de outra origem.' })
  renovar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoDto | object> {
    return this.renovarSessao(req, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'sairDoPainel', summary: 'Encerra a sessão e apaga o cookie.' })
  @ApiNoContentResponse()
  sair(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return this.encerrarSessao(req, res);
  }

  @Post('convites/aceitar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'aceitarConvite',
    summary: 'Cria a senha pelo link do convite e já entra no painel.',
  })
  @ApiOkResponse({ type: SessaoDto })
  @ApiNotFoundResponse({ description: 'Convite inexistente.' })
  @ApiGoneResponse({ description: 'Convite expirado ou já usado.' })
  @ApiConflictResponse({ description: 'Já existe usuário com este e-mail.' })
  async aceitar(
    @Body() corpo: AceitarConviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoDto> {
    const resultado = await this.aceitarConvite.executar(this.contexto.tenant().id, corpo);
    switch (resultado.tipo) {
      case 'inexistente':
        throw new NotFoundException('Convite não encontrado.');
      case 'indisponivel':
        throw new GoneException('Convite expirado ou já usado.');
      case 'email-em-uso':
        throw new ConflictException('Já existe um usuário com este e-mail.');
      case 'ok':
        return responder(res, this.publico, resultado.sessao);
    }
  }

  @Post('esqueci-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'esqueciSenhaDoPainel',
    summary: 'Envia o link de redefinição se o e-mail tiver conta (a resposta é sempre 204).',
  })
  @ApiNoContentResponse()
  esqueci(@Body() corpo: EsqueciSenhaDoPainelDto): Promise<void> {
    return this.solicitarRedefinicao(corpo.email);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'redefinirSenhaDoPainel', summary: 'Nova senha pelo link.' })
  @ApiNoContentResponse()
  @ApiGoneResponse({ description: 'Link expirado ou já usado.' })
  redefinirPeloLink(@Body() corpo: RedefinirSenhaDto): Promise<void> {
    return this.redefinirSenha(corpo);
  }
}

@ApiTags('autenticacao')
@Publica()
@Controller('auth/aluno')
export class AutenticacaoDoAlunoController extends SessaoDoApp {
  protected readonly publico = 'aluno';

  constructor(
    contexto: ContextoDoTenant,
    sessoes: Sessoes,
    solicitar: SolicitarRedefinicaoDeSenha,
    redefinir: RedefinirSenha,
    private readonly entrar: EntrarComoAluno,
    private readonly primeiroAcesso: PrimeiroAcessoDoAluno,
  ) {
    super(contexto, sessoes, solicitar, redefinir);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'entrarNoApp', summary: 'Login do aluno (CPF ou e-mail e senha).' })
  @ApiOkResponse({ type: SessaoDto, description: 'Grava o cookie gymos_rt_aluno.' })
  @ApiUnauthorizedResponse({ description: CREDENCIAIS_INVALIDAS })
  @ApiTooManyRequestsResponse({ description: MUITAS_TENTATIVAS })
  async login(
    @Body() corpo: EntrarNoAppDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoDto> {
    return sessaoDaEntrada(
      res,
      this.publico,
      await this.entrar.executar(this.tentativa(req), corpo),
    );
  }

  @Post('primeiro-acesso')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'primeiroAcessoNoApp',
    summary: 'Cria a senha com o código entregue pela recepção e já entra no app.',
  })
  @ApiOkResponse({ type: SessaoDto })
  @ApiUnauthorizedResponse({ description: 'Identificador ou código inválido ou expirado.' })
  @ApiTooManyRequestsResponse({ description: MUITAS_TENTATIVAS })
  async criarSenha(
    @Body() corpo: PrimeiroAcessoDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoDto> {
    const resultado = await this.primeiroAcesso.executar(this.tentativa(req), corpo);
    return sessaoDaEntrada(res, this.publico, resultado);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'renovarSessaoDoApp',
    summary: 'Troca o refresh do cookie por um novo par (rotativo; reuso revoga a família).',
  })
  @ApiOkResponse({ type: SessaoDto })
  @ApiUnauthorizedResponse({ description: SESSAO_ENCERRADA })
  @ApiForbiddenResponse({ description: 'Sem o cabeçalho x-gymos-csrf ou de outra origem.' })
  renovar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessaoDto | object> {
    return this.renovarSessao(req, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'sairDoApp', summary: 'Encerra a sessão e apaga o cookie.' })
  @ApiNoContentResponse()
  sair(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    return this.encerrarSessao(req, res);
  }

  @Post('esqueci-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'esqueciSenhaDoApp',
    summary: 'Envia o link de redefinição ao e-mail da conta, se houver (a resposta é sempre 204).',
  })
  @ApiNoContentResponse()
  esqueci(@Body() corpo: EsqueciSenhaDoAppDto): Promise<void> {
    return this.solicitarRedefinicao(corpo.identificador);
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'redefinirSenhaDoApp', summary: 'Nova senha pelo link.' })
  @ApiNoContentResponse()
  @ApiGoneResponse({ description: 'Link expirado ou já usado.' })
  redefinirPeloLink(@Body() corpo: RedefinirSenhaDto): Promise<void> {
    return this.redefinirSenha(corpo);
  }
}
