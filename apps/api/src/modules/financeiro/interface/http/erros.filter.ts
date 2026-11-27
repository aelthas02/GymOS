import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  type HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FiltroInvalidoError, LancamentoInvalidoError } from '../../application/erros';

function paraHttp(erro: Error): HttpException {
  return erro instanceof LancamentoInvalidoError
    ? new UnprocessableEntityException(erro.message)
    : new BadRequestException(erro.message);
}

/** Erros do financeiro: 422 (lançamento) ou 400 (período, filtro ou cursor inválido). */
@Catch(LancamentoInvalidoError, FiltroInvalidoError)
export class ErrosDoFinanceiroFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
