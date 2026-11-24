-- Campos da proteção de dados (T13c), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "acesso_a_dado_sensivel" ADD COLUMN     "acessado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "campo" TEXT NOT NULL,
ADD COLUMN     "quem" TEXT NOT NULL,
ADD COLUMN     "titular_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "chave_do_tenant" ADD COLUMN     "chave_de_dados" TEXT NOT NULL,
ADD COLUMN     "chave_de_indice" TEXT NOT NULL,
ADD COLUMN     "id_da_chave_mestra" TEXT NOT NULL,
ADD COLUMN     "versao" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "consentimento" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "decisao" TEXT NOT NULL,
ADD COLUMN     "finalidade" TEXT NOT NULL,
ADD COLUMN     "origem" TEXT NOT NULL,
ADD COLUMN     "registrado_em" TIMESTAMPTZ(3) NOT NULL;

-- CreateIndex
CREATE INDEX "acesso_a_dado_sensivel_tenant_id_titular_id_idx" ON "acesso_a_dado_sensivel"("tenant_id", "titular_id");

-- CreateIndex
CREATE UNIQUE INDEX "chave_do_tenant_tenant_id_versao_key" ON "chave_do_tenant"("tenant_id", "versao");

-- CreateIndex
CREATE INDEX "consentimento_tenant_id_aluno_id_finalidade_registrado_em_idx" ON "consentimento"("tenant_id", "aluno_id", "finalidade", "registrado_em");
