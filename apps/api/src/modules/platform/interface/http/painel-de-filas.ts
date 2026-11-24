import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { CABECALHO_DA_CHAVE_DE_OPERACAO } from './interno.controller';
import { cabecalho } from './cabecalho';

export const CAMINHO_DO_PAINEL = '/interno/filas';

type Middleware = (req: IncomingMessage, res: ServerResponse, proximo: () => void) => void;

function resumo(valor: string): Buffer {
  return createHash('sha256').update(valor).digest();
}

/** Aceita a chave de operação no cabeçalho ou como senha do Basic (para abrir no navegador). */
function chaveRecebida(req: IncomingMessage): string | undefined {
  const direta = cabecalho(req, CABECALHO_DA_CHAVE_DE_OPERACAO);
  if (direta) {
    return direta;
  }
  const [esquema, credenciais] = (cabecalho(req, 'authorization') ?? '').split(' ');
  if (esquema?.toLowerCase() !== 'basic' || !credenciais) {
    return undefined;
  }
  const decodificadas = Buffer.from(credenciais, 'base64').toString('utf-8');
  return decodificadas.slice(decodificadas.indexOf(':') + 1);
}

export function protecaoDoPainel(chaveDeOperacao: string): Middleware {
  return (req, res, proximo) => {
    const recebida = chaveRecebida(req);
    if (recebida && timingSafeEqual(resumo(recebida), resumo(chaveDeOperacao))) {
      proximo();
      return;
    }
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="Filas do GymOS"');
    res.end();
  };
}

/** Painel do bull-board com as filas dadas, servido em /interno/filas. */
export function routerDoPainel(filas: Queue[]): unknown {
  const adaptador = new ExpressAdapter();
  adaptador.setBasePath(CAMINHO_DO_PAINEL);
  createBullBoard({
    queues: filas.map((fila) => new BullMQAdapter(fila)),
    serverAdapter: adaptador,
  });
  return adaptador.getRouter();
}
