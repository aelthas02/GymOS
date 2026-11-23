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

interface OpenapiTypescript {
  default: (fonte: unknown) => Promise<unknown>;
  astToString: (ast: unknown) => string;
  COMMENT_HEADER: string;
}

// new Function evita que o webpack tente empacotar o import dinâmico (o pacote é só ESM).
const importar = new Function('s', 'return import(s)') as (
  especificador: string,
) => Promise<OpenapiTypescript>;

/** Tipos `paths` e `components` do openapi-typescript para o cliente de libs/api-contracts. */
export async function gerarTipos(contrato: string): Promise<string> {
  const openapiTs = await importar('openapi-typescript');
  const ast = await openapiTs.default(JSON.parse(contrato));
  return `${openapiTs.COMMENT_HEADER}${openapiTs.astToString(ast)}`;
}

/** Falha se o arquivo commitado não existir ou diferir do gerado (job de divergência do CI). */
export function verificarContrato(arquivo: string, gerado: string): void {
  const commitado = existsSync(arquivo) ? readFileSync(arquivo, 'utf-8') : null;
  if (commitado?.replace(/\r\n/g, '\n') !== gerado) {
    throw new ContratoDivergenteError(arquivo);
  }
}
