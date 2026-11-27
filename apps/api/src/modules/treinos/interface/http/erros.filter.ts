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
import { ConflitoError, NaoEncontradoError } from '../../application/erros';
import { TreinoInvalidoError } from '../../domain/ficha';

function paraHttp(erro: Error): HttpException {
  if (erro instanceof NaoEncontradoError) {
    return new NotFoundException(erro.message);
  }
  if (erro instanceof ConflitoError) {
    return new ConflictException(erro.message);
  }
  return new BadRequestException(erro.message);
}

/** Erros dos casos de uso de treinos: 404, 409 ou 400 com a mensagem do domínio. */
@Catch(NaoEncontradoError, ConflitoError, TreinoInvalidoError)
export class ErrosDosTreinosFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
