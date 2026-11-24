import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  type HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { NaoEncontradoError } from '../../application/erros';
import { AvisoInvalidoError } from '../../domain/aviso';

function paraHttp(erro: Error): HttpException {
  return erro instanceof NaoEncontradoError
    ? new NotFoundException(erro.message)
    : new BadRequestException(erro.message);
}

/** Erros dos casos de uso de avisos: 404 ou 400 com a mensagem do domínio. */
@Catch(NaoEncontradoError, AvisoInvalidoError)
export class ErrosDosAvisosFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
