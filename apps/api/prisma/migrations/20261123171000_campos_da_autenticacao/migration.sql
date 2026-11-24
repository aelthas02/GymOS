-- Campos do domínio de autenticação (T12), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "convite" ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "expira_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "nome" TEXT,
ADD COLUMN     "tipo_de_acesso_id" UUID NOT NULL,
ADD COLUMN     "token_hash" TEXT NOT NULL,
ADD COLUMN     "usado_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "credencial_aluno" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "codigo_expira_em" TIMESTAMPTZ(3),
ADD COLUMN     "codigo_hash" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "senha_hash" TEXT;

-- AlterTable
ALTER TABLE "modulo_do_tenant" ADD COLUMN     "ativo" BOOLEAN NOT NULL,
ADD COLUMN     "modulo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "redefinicao_de_senha" ADD COLUMN     "expira_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "publico" TEXT NOT NULL,
ADD COLUMN     "sujeito_id" UUID NOT NULL,
ADD COLUMN     "token_hash" TEXT NOT NULL,
ADD COLUMN     "usado_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "tipo_de_acesso" ADD COLUMN     "chave" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "permissoes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "token_de_refresh" ADD COLUMN     "expira_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "familia_id" UUID NOT NULL,
ADD COLUMN     "publico" TEXT NOT NULL,
ADD COLUMN     "revogado_em" TIMESTAMPTZ(3),
ADD COLUMN     "sujeito_id" UUID NOT NULL,
ADD COLUMN     "token_hash" TEXT NOT NULL,
ADD COLUMN     "usado_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "senha_hash" TEXT,
ADD COLUMN     "tipo_de_acesso_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "convite_token_hash_key" ON "convite"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "credencial_aluno_tenant_id_aluno_id_key" ON "credencial_aluno"("tenant_id", "aluno_id");

-- CreateIndex
CREATE UNIQUE INDEX "credencial_aluno_tenant_id_email_key" ON "credencial_aluno"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "modulo_do_tenant_tenant_id_modulo_key" ON "modulo_do_tenant"("tenant_id", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "redefinicao_de_senha_token_hash_key" ON "redefinicao_de_senha"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_de_acesso_tenant_id_id_key" ON "tipo_de_acesso"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_de_acesso_tenant_id_chave_key" ON "tipo_de_acesso"("tenant_id", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_de_acesso_tenant_id_nome_key" ON "tipo_de_acesso"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "token_de_refresh_token_hash_key" ON "token_de_refresh"("token_hash");

-- CreateIndex
CREATE INDEX "token_de_refresh_familia_id_idx" ON "token_de_refresh"("familia_id");

-- CreateIndex
CREATE INDEX "token_de_refresh_tenant_id_publico_sujeito_id_idx" ON "token_de_refresh"("tenant_id", "publico", "sujeito_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_tenant_id_email_key" ON "usuario"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tenant_id_tipo_de_acesso_id_fkey" FOREIGN KEY ("tenant_id", "tipo_de_acesso_id") REFERENCES "tipo_de_acesso"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "convite" ADD CONSTRAINT "convite_tenant_id_tipo_de_acesso_id_fkey" FOREIGN KEY ("tenant_id", "tipo_de_acesso_id") REFERENCES "tipo_de_acesso"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

