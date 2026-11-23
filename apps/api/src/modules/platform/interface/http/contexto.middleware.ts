import { BadRequestException, Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import {
  CONFIGURACAO_DA_PLATAFORMA,
  type ConfiguracaoDaPlataforma,
  permiteRecursosDeDesenvolvimento,
} from '../../infra/configuracao';
import { ContextoDoTenant, type EstadoDoContexto } from '../../infra/contexto/contexto-do-tenant';
import { cabecalho } from './cabecalho';

export const CABECALHO_DO_RELOGIO = 'x-relogio';

/** Abre o contexto da requisição (AsyncLocalStorage); em dev e teste, lê o x-relogio. */
@Injectable()
export class ContextoDaRequisicaoMiddleware implements NestMiddleware {
  constructor(
    private readonly contexto: ContextoDoTenant,
    @Inject(CONFIGURACAO_DA_PLATAFORMA) private readonly config: ConfiguracaoDaPlataforma,
  ) {}

  use(req: IncomingMessage, _res: unknown, next: () => void): void {
    const estado: EstadoDoContexto = {};
    const relogio = cabecalho(req, CABECALHO_DO_RELOGIO);
    if (relogio && permiteRecursosDeDesenvolvimento(this.config)) {
      const instante = new Date(relogio);
      if (Number.isNaN(instante.getTime())) {
        throw new BadRequestException(`${CABECALHO_DO_RELOGIO} deve ser um instante ISO-8601.`);
      }
      estado.instanteFixo = instante;
    }
    this.contexto.executar(estado, next);
  }
}
