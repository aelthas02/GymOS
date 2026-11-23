import { type Tree, names } from '@nx/devkit';

// Gerador `nx g @gymos/api:tabela <dominio> <nome>` (ADR-003). Cria o modelo Prisma, a migração com
// RLS forçado, a política por app.tenant_id e o DML do gymos_app, e o teste de convenção da tabela.
// O SQL repete o que o `prisma migrate diff` gera para o modelo: o teste de deriva compara os dois.
// O Nx carrega este arquivo com o type stripping do Node: só sintaxe TypeScript apagável.

export interface OpcoesDaTabela {
  dominio: string;
  nome: string;
}

const FORMATO = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RAIZ = 'apps/api';

export function nomesDaTabela(nome: string): { tabela: string; modelo: string } {
  return { tabela: nome.replaceAll('-', '_'), modelo: names(nome).className };
}

function carimbo(agora: Date): string {
  return agora.toISOString().replace(/\D/g, '').slice(0, 14);
}

function modeloPrisma(modelo: string, tabela: string): string {
  return `
/// Gerado por \`nx g @gymos/api:tabela\`: RLS por tenant (ADR-003). Acrescente os campos do domínio
/// e gere a migração seguinte com \`prisma migrate diff\`.
model ${modelo} {
  id       String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId String   @map("tenant_id") @db.Uuid
  criadoEm DateTime @default(now()) @map("criado_em") @db.Timestamptz(3)

  @@index([tenantId])
  @@map("${tabela}")
}
`;
}

function migracao(tabela: string): string {
  const politica = `"tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid`;
  return `-- CreateTable
CREATE TABLE "${tabela}" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "${tabela}_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "${tabela}_tenant_id_idx" ON "${tabela}"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "${tabela}" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "${tabela}" FORCE ROW LEVEL SECURITY;
CREATE POLICY "${tabela}_isolamento_por_tenant" ON "${tabela}"
    USING (${politica})
    WITH CHECK (${politica});
GRANT SELECT, INSERT, UPDATE, DELETE ON "${tabela}" TO gymos_app;
`;
}

function testeDeConvencao(tabela: string): string {
  return `import { verificarConvencaoDeRls } from '../../platform/infra/database/convencao-rls';
import { usarBancoDeTeste } from '../../platform/testing/banco-de-teste';

describe('tabela ${tabela}', () => {
  const banco = usarBancoDeTeste();

  it('segue a convenção de RLS por tenant', async () => {
    const migrador = await banco.conectarComoMigrador();

    expect(await verificarConvencaoDeRls(migrador, { tabelas: ['${tabela}'] })).toEqual([]);
  });
});
`;
}

export default async function geradorDeTabela(
  tree: Tree,
  opcoes: OpcoesDaTabela,
  agora: Date = new Date(),
): Promise<void> {
  for (const [campo, valor] of Object.entries(opcoes)) {
    if (!FORMATO.test(valor)) {
      throw new Error(
        `${campo} "${valor}" deve ser kebab-case minúsculo (ex.: contrato-de-plano).`,
      );
    }
  }
  const { tabela, modelo } = nomesDaTabela(opcoes.nome);
  const arquivoDoSchema = `${RAIZ}/prisma/schema/${opcoes.dominio}.prisma`;
  const schema =
    tree.read(arquivoDoSchema, 'utf-8') ?? `// Modelos do domínio ${opcoes.dominio}.\n`;
  if (new RegExp(`^model ${modelo} \\{`, 'm').test(schema)) {
    throw new Error(`O modelo ${modelo} já existe em ${arquivoDoSchema}.`);
  }
  tree.write(arquivoDoSchema, schema + modeloPrisma(modelo, tabela));
  tree.write(
    `${RAIZ}/prisma/migrations/${carimbo(agora)}_criar_${tabela}/migration.sql`,
    migracao(tabela),
  );
  tree.write(
    `${RAIZ}/src/modules/${opcoes.dominio}/infra/${opcoes.nome}.convencao.int.spec.ts`,
    testeDeConvencao(tabela),
  );
}
