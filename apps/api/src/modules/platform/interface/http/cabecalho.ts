import type { IncomingMessage } from 'node:http';

/** Valor de um cabeçalho, ou o primeiro quando vier repetido. */
export function cabecalho(req: IncomingMessage, nome: string): string | undefined {
  const valor = req.headers[nome.toLowerCase()];
  return Array.isArray(valor) ? valor[0] : valor;
}
