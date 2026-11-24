-- Campos do domínio funcionarios (T26a), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "funcionario" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cargo" TEXT NOT NULL,
ADD COLUMN     "cargo_descricao" TEXT,
ADD COLUMN     "custo_mensal_centavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "tipo_de_acesso_id" UUID,
ADD COLUMN     "usuario_id" UUID;

-- CreateIndex
CREATE INDEX "funcionario_tenant_id_cargo_idx" ON "funcionario"("tenant_id", "cargo");

-- CreateIndex
CREATE INDEX "funcionario_tenant_id_nome_idx" ON "funcionario"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_tenant_id_id_key" ON "funcionario"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_tenant_id_email_key" ON "funcionario"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "funcionario_tenant_id_usuario_id_key" ON "funcionario"("tenant_id", "usuario_id");
