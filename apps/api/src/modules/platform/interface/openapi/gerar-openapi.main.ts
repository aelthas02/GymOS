import { NestFactory } from '@nestjs/core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../../../../app/app.module';
import {
  ContratoDivergenteError,
  criarDocumentoOpenApi,
  gerarTipos,
  PREFIXO_DA_API,
  serializarContrato,
  verificarContrato,
} from './contrato';

// Entrada do build (dist/apps/api/gerar-openapi.js), rodada da raiz do workspace:
//   pnpm nx run api:openapi        → escreve libs/api-contracts/openapi.json e os tipos
//   pnpm nx run api:openapi-check  → falha se o commitado divergir do gerado (job do CI)
const ARQUIVO_DO_CONTRATO = 'libs/api-contracts/openapi.json';
const ARQUIVO_DOS_TIPOS = 'libs/api-contracts/src/generated/schema.ts';

async function principal(): Promise<void> {
  // Só monta o app para ler os controllers: sem .env (CI), valem os valores de exemplo.
  if (existsSync('.env.example')) {
    process.loadEnvFile('.env.example');
  }
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix(PREFIXO_DA_API);
  const contrato = serializarContrato(criarDocumentoOpenApi(app));
  await app.close();
  const tipos = await gerarTipos(contrato);

  if (process.argv.includes('--verificar')) {
    verificarContrato(resolve(ARQUIVO_DO_CONTRATO), contrato);
    verificarContrato(resolve(ARQUIVO_DOS_TIPOS), tipos);
    console.log('Contrato OpenAPI em dia.');
    return;
  }
  for (const [arquivo, conteudo] of [
    [ARQUIVO_DO_CONTRATO, contrato],
    [ARQUIVO_DOS_TIPOS, tipos],
  ] as const) {
    mkdirSync(dirname(resolve(arquivo)), { recursive: true });
    writeFileSync(resolve(arquivo), conteudo);
  }
  console.log(`Contrato gerado em ${ARQUIVO_DO_CONTRATO} e ${ARQUIVO_DOS_TIPOS}.`);
}

principal().catch((error: unknown) => {
  const mensagem = error instanceof ContratoDivergenteError ? error.message : String(error);
  console.error(mensagem);
  process.exit(1);
});
