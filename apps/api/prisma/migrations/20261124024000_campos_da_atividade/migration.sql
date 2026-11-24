-- Campos do log de atividades (T13b), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "atividade" ADD COLUMN     "acao" TEXT NOT NULL,
ADD COLUMN     "detalhe" TEXT NOT NULL,
ADD COLUMN     "modulo" TEXT NOT NULL,
ADD COLUMN     "ocorrido_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "ordem" BIGSERIAL NOT NULL,
ADD COLUMN     "papel" TEXT NOT NULL,
ADD COLUMN     "quem" TEXT NOT NULL,
ADD COLUMN     "quem_id" UUID,
ADD COLUMN     "sensivel" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "atividade_tenant_id_ocorrido_em_ordem_idx" ON "atividade"("tenant_id", "ocorrido_em", "ordem");

-- CreateIndex
CREATE INDEX "atividade_ocorrido_em_idx" ON "atividade"("ocorrido_em");

-- A sequência da ordem (BIGSERIAL) precisa de permissão própria para o gymos_app inserir.
GRANT USAGE ON SEQUENCE "atividade_ordem_seq" TO gymos_app;
