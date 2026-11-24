import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  type ExceptionFilter,
  type HttpException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ArquivoRecusadoError, ChaveDeOutroTenantError } from '../../domain/armazenamento';
import { ConexaoInvalidaError } from '../../domain/meta';

const ERROS = [ArquivoRecusadoError, ChaveDeOutroTenantError, ConexaoInvalidaError];

function paraHttp(erro: Error): HttpException {
  if (erro instanceof ChaveDeOutroTenantError) {
    return new NotFoundException('Arquivo não encontrado.');
  }
  if (erro instanceof ArquivoRecusadoError) {
    return erro.motivo === 'arquivo_grande_demais'
      ? new PayloadTooLargeException(erro.message)
      : new BadRequestException(erro.message);
  }
  return new ConflictException(erro.message);
}

/** Erros das integrações: arquivo recusado (400 ou 413), chave de outro tenant (404) e conexão (409). */
@Catch(...ERROS)
export class ErrosDasIntegracoesFilter implements ExceptionFilter {
  catch(erro: Error, host: ArgumentsHost): void {
    const http = paraHttp(erro);
    host.switchToHttp().getResponse<Response>().status(http.getStatus()).json(http.getResponse());
  }
}
