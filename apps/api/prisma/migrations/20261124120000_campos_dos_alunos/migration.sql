-- Campos do domínio alunos (T15a), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "aluno" ADD COLUMN     "cpf" TEXT NOT NULL,
ADD COLUMN     "cpf_hash" TEXT NOT NULL,
ADD COLUMN     "data_nascimento" DATE,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "email_hash" TEXT,
ADD COLUMN     "lead_id" UUID,
ADD COLUMN     "meta" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "professor_id" UUID,
ADD COLUMN     "restricoes" TEXT,
ADD COLUMN     "telefone" TEXT,
ADD COLUMN     "telefone_hash" TEXT,
ADD COLUMN     "unidade_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "configuracao_de_contrato" ADD COLUMN     "reativacao_dias" INTEGER NOT NULL,
ADD COLUMN     "tolerancia_dias" INTEGER NOT NULL,
ADD COLUMN     "trancamento_maximo_dias" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "contrato" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "encerrado_em" DATE,
ADD COLUMN     "estado" TEXT NOT NULL,
ADD COLUMN     "fim" DATE NOT NULL,
ADD COLUMN     "inicio" DATE NOT NULL,
ADD COLUMN     "motivo_do_encerramento" TEXT,
ADD COLUMN     "parcelas" INTEGER NOT NULL,
ADD COLUMN     "plano_id" UUID NOT NULL,
ADD COLUMN     "proximo_vencimento" DATE,
ADD COLUMN     "trancado_ate" DATE,
ADD COLUMN     "trancado_desde" DATE,
ADD COLUMN     "valor_total_centavos" INTEGER NOT NULL,
ADD COLUMN     "vencimento_em_atraso" DATE,
ADD COLUMN     "vigente" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "plano" ADD COLUMN     "acessos_por_semana" INTEGER,
ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "duracao_meses" INTEGER NOT NULL,
ADD COLUMN     "excluido_em" TIMESTAMPTZ(3),
ADD COLUMN     "forma_de_cobranca" TEXT NOT NULL,
ADD COLUMN     "modalidades" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "parcelas" INTEGER NOT NULL,
ADD COLUMN     "renovacao_automatica" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "valor_total_centavos" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "aluno_tenant_id_telefone_hash_idx" ON "aluno"("tenant_id", "telefone_hash");

-- CreateIndex
CREATE INDEX "aluno_tenant_id_email_hash_idx" ON "aluno"("tenant_id", "email_hash");

-- CreateIndex
CREATE INDEX "aluno_tenant_id_nome_idx" ON "aluno"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "aluno_tenant_id_id_key" ON "aluno"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "aluno_tenant_id_cpf_hash_key" ON "aluno"("tenant_id", "cpf_hash");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_de_contrato_tenant_id_key" ON "configuracao_de_contrato"("tenant_id");

-- CreateIndex
CREATE INDEX "contrato_tenant_id_aluno_id_vigente_idx" ON "contrato"("tenant_id", "aluno_id", "vigente");

-- CreateIndex
CREATE INDEX "contrato_tenant_id_plano_id_vigente_idx" ON "contrato"("tenant_id", "plano_id", "vigente");

-- CreateIndex
CREATE UNIQUE INDEX "plano_tenant_id_id_key" ON "plano"("tenant_id", "id");

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_tenant_id_aluno_id_fkey" FOREIGN KEY ("tenant_id", "aluno_id") REFERENCES "aluno"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_tenant_id_plano_id_fkey" FOREIGN KEY ("tenant_id", "plano_id") REFERENCES "plano"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

