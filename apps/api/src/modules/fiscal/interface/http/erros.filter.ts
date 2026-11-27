import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  type ExceptionFilter,
  type HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DadosDaNotaInvalidosError,
  DadosFiscaisAusentesError,
  NaoEncontradoError,
} from '../../application/erros';
import { EmissorRecusouError } from '../../application/portas';
import { OperacaoDaNotaInvalidaError } from '../../domain/nota-fiscal';
import { CursorDeNotasInvalidoError } from '../../infra/repositorios.prisma';

const ERROS = [
  NaoEncontradoError,
  DadosFiscaisAusentesError,
  DadosDaNotaInvalidosError,
  EmissorRecusouError,
  OperacaoDaNotaInvalidaError,
  CursorDeNotasInvalidoError,
];

function paraHttp(erro: Error): HttpException {
  if (erro instanceof NaoEncontradoError) {
    return new NotFoundException(erro.message);
  }
  if (erro instanceof CursorDeNotasInvalidoError) {
    return new BadRequestException(erro.message);
  }
  if (erro instanceof DadosFiscaisAusentesError || erro instanceof DadosDaNotaInvalidosError) {
    return new UnprocessableEntityException(erro.message);
  }
  return new ConflictException(erro.message);
}

/** Erros do fiscal: 404, 400 (cursor), 422 (dados) ou 409 (situação da nota e recusa do emissor). */
@Catch(...ERROS)
export class ErrosDoFiscalFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
