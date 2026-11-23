import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { AppModule } from '../../../../app/app.module';
import { CriarAcademia } from '../../application/casos-de-uso';
import { credenciaisDaUrl, prepararBanco } from '../../infra/database/preparar-banco';

// Comando de operação (dist/apps/api/gymos.js), pela raiz: `pnpm gymos <comando> [opções]`.
//   preparar-banco   cria gymos_migrator e gymos_app, o banco de DATABASE_URL e os privilégios
//   criar-academia   --slug --nome --admin-email [--cor] [--unidade]
const AJUDA = `Uso: pnpm gymos <comando>

  preparar-banco
      Cria os papéis gymos_migrator e gymos_app, o banco de DATABASE_URL e os privilégios
      de schema, com a conta de DATABASE_ADMIN_URL. Depois: pnpm nx run api:migrar.

  criar-academia --slug ritmo --nome "Academia Ritmo" --admin-email adm@ritmo.com.br
                 [--cor "#22C98A"] [--unidade "Unidade Centro"]
      Cria o tenant, a primeira unidade e o convite do administrador (imprime o link).`;

const postgres = z.url({ protocol: /^postgres(ql)?$/ });

async function prepararBancoDoAmbiente(): Promise<void> {
  const env = z
    .object({
      DATABASE_ADMIN_URL: postgres,
      DATABASE_URL: postgres,
      DATABASE_MIGRATOR_URL: postgres,
    })
    .parse(process.env);
  const banco = decodeURIComponent(new URL(env.DATABASE_URL).pathname.slice(1));
  const { bancoCriado } = await prepararBanco({
    urlAdmin: env.DATABASE_ADMIN_URL,
    banco,
    migrador: credenciaisDaUrl(env.DATABASE_MIGRATOR_URL),
    app: credenciaisDaUrl(env.DATABASE_URL),
  });
  console.log(
    `Banco ${banco} ${bancoCriado ? 'criado' : 'já existia'}; papéis e privilégios em dia.`,
  );
}

async function criarAcademia(argumentos: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argumentos,
    options: {
      slug: { type: 'string' },
      nome: { type: 'string' },
      'admin-email': { type: 'string' },
      cor: { type: 'string' },
      unidade: { type: 'string' },
    },
  });
  if (!values.slug || !values.nome || !values['admin-email']) {
    throw new Error(`criar-academia exige --slug, --nome e --admin-email.\n\n${AJUDA}`);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const criada = await app.get(CriarAcademia).executar({
      slug: values.slug,
      nome: values.nome,
      adminEmail: values['admin-email'],
      corDestaque: values.cor,
      nomeDaUnidade: values.unidade,
    });
    console.log(`Academia ${criada.slug} criada (tenant ${criada.tenantId}).`);
    console.log(`Convite do administrador (até o T12, envie este link): ${criada.linkDoConvite}`);
  } finally {
    await app.close();
  }
}

async function principal([comando, ...argumentos]: string[]): Promise<void> {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }
  switch (comando) {
    case 'preparar-banco':
      return prepararBancoDoAmbiente();
    case 'criar-academia':
      return criarAcademia(argumentos);
    default:
      console.log(AJUDA);
      if (comando && comando !== '--help') {
        process.exitCode = 1;
      }
  }
}

principal(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
