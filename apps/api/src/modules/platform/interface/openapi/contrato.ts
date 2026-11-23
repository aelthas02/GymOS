import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { existsSync, readFileSync } from 'node:fs';

/** Prefixo global das rotas; o main.ts usa o mesmo valor. */
export const PREFIXO_DA_API = 'api';

export const COMANDO_DE_REGENERACAO = 'pnpm nx run api:openapi';

export class ContratoDivergenteError extends Error {
  constructor(arquivo: string) {
    super(
      `O contrato em ${arquivo} não bate com a API. Rode \`${COMANDO_DE_REGENERACAO}\` e ` +
        'commite o openapi.json e os tipos gerados no mesmo PR (ADR-005).',
    );
    this.name = 'ContratoDivergenteError';
  }
}

export function criarDocumentoOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('GymOS API')
    .setDescription('Contrato único da API do GymOS, gerado pelo @nestjs/swagger (ADR-005).')
    .setVersion('1')
    .build();
  return SwaggerModule.createDocument(app, config);
}

function ordenarChaves(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(ordenarChaves);
  }
  if (typeof valor === 'object' && valor !== null) {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((chave) => [chave, ordenarChaves((valor as Record<string, unknown>)[chave])]),
    );
  }
  return valor;
}

/** JSON estável: chaves ordenadas, indentação de 2 espaços e quebra de linha no fim. */
export function serializarContrato(documento: OpenAPIObject): string {
  return `${JSON.stringify(ordenarChaves(documento), null, 2)}\n`;
}

/** Falha se o arquivo commitado não existir ou diferir do gerado (job de divergência do CI). */
export function verificarContrato(arquivo: string, gerado: string): void {
  const commitado = existsSync(arquivo) ? readFileSync(arquivo, 'utf-8') : null;
  if (commitado?.replace(/\r\n/g, '\n') !== gerado) {
    throw new ContratoDivergenteError(arquivo);
  }
}
