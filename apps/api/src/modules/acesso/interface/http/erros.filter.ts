import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  type HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfiguracaoDeAlertasInvalidaError } from '../../domain/alerta';
import { NaoEncontradoError, RegistroDeAcessoInvalidoError } from '../../application/erros';

function paraHttp(erro: Error): HttpException {
  return erro instanceof NaoEncontradoError
    ? new NotFoundException(erro.message)
    : new BadRequestException(erro.message);
}

/** Erros dos casos de uso de acesso: 404 ou 400 com a mensagem do domínio. */
@Catch(NaoEncontradoError, RegistroDeAcessoInvalidoError, ConfiguracaoDeAlertasInvalidaError)
export class ErrosDoAcessoFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
