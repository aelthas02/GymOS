-- Campos do domínio financeiro (T21), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "lancamento" ADD COLUMN     "categoria" TEXT NOT NULL,
ADD COLUMN     "criado_por" UUID,
ADD COLUMN     "data" DATE NOT NULL,
ADD COLUMN     "descricao" TEXT,
ADD COLUMN     "setor" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "unidade_id" UUID NOT NULL,
ADD COLUMN     "valor_centavos" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "lancamento_tenant_id_data_idx" ON "lancamento"("tenant_id", "data");

-- CreateIndex
CREATE INDEX "pagamento_tenant_id_confirmado_em_idx" ON "pagamento"("tenant_id", "confirmado_em");
