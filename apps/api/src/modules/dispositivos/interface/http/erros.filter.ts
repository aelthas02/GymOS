import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  type HttpException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  CodigoDePareamentoInvalidoError,
  ConsentimentoDeBiometriaNecessarioError,
  CredencialDoAgenteInvalidaError,
  DispositivoInvalidoError,
  NaoEncontradoError,
} from '../../application/erros';

function paraHttp(erro: Error): HttpException {
  if (erro instanceof NaoEncontradoError) {
    return new NotFoundException(erro.message);
  }
  if (erro instanceof CredencialDoAgenteInvalidaError) {
    return new UnauthorizedException(erro.message);
  }
  if (erro instanceof ConsentimentoDeBiometriaNecessarioError) {
    return new UnprocessableEntityException(erro.message);
  }
  return new BadRequestException(erro.message);
}

/** Erros dos casos de uso de dispositivos: 400, 401, 404 ou 422 com a mensagem do domínio. */
@Catch(
  NaoEncontradoError,
  DispositivoInvalidoError,
  CodigoDePareamentoInvalidoError,
  CredencialDoAgenteInvalidaError,
  ConsentimentoDeBiometriaNecessarioError,
)
export class ErrosDosDispositivosFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
