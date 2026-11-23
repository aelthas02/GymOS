import {
  BadRequestException,
  Body,
  type CanActivate,
  ConflictException,
  Controller,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import {
  type AcademiaCriada,
  CriarAcademia,
  SlugEmUsoError,
  SlugInvalidoError,
} from '../../application/casos-de-uso';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
} from '../../infra/configuracao';
import { Publica } from './acesso-publico';
import { cabecalho } from './cabecalho';
import { CriarAcademiaDto } from './dto/criar-academia.dto';

export const CABECALHO_DA_CHAVE_DE_OPERACAO = 'x-chave-de-operacao';

function resumo(valor: string): Buffer {
  return createHash('sha256').update(valor).digest();
}

/** Sem OPERACAO_API_KEY configurada o endpoint não existe (404); chave errada responde 401. */
@Injectable()
export class ChaveDeOperacaoGuard implements CanActivate {
  constructor(
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly config: ConfiguracaoDaPlataforma,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const esperada = this.config.chaveDeOperacao;
    if (!esperada) {
      throw new NotFoundException();
    }
    const req = context.switchToHttp().getRequest<IncomingMessage>();
    const recebida = cabecalho(req, CABECALHO_DA_CHAVE_DE_OPERACAO);
    if (!recebida || !timingSafeEqual(resumo(recebida), resumo(esperada))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

@ApiExcludeController()
@Publica()
@UseGuards(ChaveDeOperacaoGuard)
@Controller('interno/academias')
export class InternoController {
  constructor(private readonly criarAcademia: CriarAcademia) {}

  @Post()
  async criar(@Body() corpo: CriarAcademiaDto): Promise<AcademiaCriada> {
    try {
      return await this.criarAcademia.executar(corpo);
    } catch (error) {
      if (error instanceof SlugEmUsoError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof SlugInvalidoError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
