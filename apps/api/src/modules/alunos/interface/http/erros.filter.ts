import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  type ExceptionFilter,
  type HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AlunoInvalidoError } from '../../application/alunos';
import { ConflitoError, NaoEncontradoError } from '../../application/erros';
import {
  ConfiguracaoDeContratoInvalidaError,
  OperacaoDeContratoInvalidaError,
} from '../../domain/contrato';
import { PlanoInvalidoError } from '../../domain/plano';
import { CursorDeAlunosInvalidoError } from '../../infra/repositorios.prisma';

export class DataInvalidaError extends Error {
  constructor(campo: string) {
    super(`${campo}: data inexistente.`);
    this.name = 'DataInvalidaError';
  }
}

const ERROS = [
  NaoEncontradoError,
  ConflitoError,
  AlunoInvalidoError,
  PlanoInvalidoError,
  OperacaoDeContratoInvalidaError,
  ConfiguracaoDeContratoInvalidaError,
  CursorDeAlunosInvalidoError,
  DataInvalidaError,
];

function paraHttp(erro: Error): HttpException {
  if (erro instanceof NaoEncontradoError) {
    return new NotFoundException(erro.message);
  }
  if (erro instanceof ConflitoError || erro instanceof OperacaoDeContratoInvalidaError) {
    return new ConflictException(erro.message);
  }
  return new BadRequestException(erro.message);
}

/** Erros dos casos de uso de alunos, planos e contratos: 404, 409 ou 400 com a mensagem do domínio. */
@Catch(...ERROS)
export class ErrosDosAlunosFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
