import {
  type ArgumentsHost,
  Catch,
  ConflictException,
  type ExceptionFilter,
  type HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { NaoEncontradoError } from '../../application/erros';
import { OperacaoDePagamentoInvalidaError } from '../../domain/pagamento';
import { OperacaoDeParcelaInvalidaError } from '../../domain/parcela';

const ERROS = [
  NaoEncontradoError,
  OperacaoDePagamentoInvalidaError,
  OperacaoDeParcelaInvalidaError,
];

function paraHttp(erro: Error): HttpException {
  return erro instanceof NaoEncontradoError
    ? new NotFoundException(erro.message)
    : new ConflictException(erro.message);
}

/** Erros dos casos de uso da cobrança: 404 ou 409 com a mensagem do domínio. */
@Catch(...ERROS)
export class ErrosDaCobrancaFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
