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
import { FuncionarioInvalidoError } from '../../domain/funcionario';

function paraHttp(erro: Error): HttpException {
  if (erro instanceof NaoEncontradoError) {
    return new NotFoundException(erro.message);
  }
  if (erro instanceof ConflitoError) {
    return new ConflictException(erro.message);
  }
  return new BadRequestException(erro.message);
}

/** Erros dos casos de uso de funcionários: 404, 409 ou 400 com a mensagem do domínio. */
@Catch(NaoEncontradoError, ConflitoError, FuncionarioInvalidoError)
export class ErrosDosFuncionariosFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
