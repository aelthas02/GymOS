-- Campos do domínio integracoes (T13d), gerados por prisma migrate diff.

-- AlterTable
ALTER TABLE "conexao_meta" ADD COLUMN     "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "canal" TEXT NOT NULL,
ADD COLUMN     "conectado_em" TIMESTAMPTZ(3),
ADD COLUMN     "conta_id" TEXT,
ADD COLUMN     "conta_nome" TEXT,
ADD COLUMN     "estado" TEXT NOT NULL,
ADD COLUMN     "expira_em" TIMESTAMPTZ(3),
ADD COLUMN     "token" TEXT;

-- AlterTable
ALTER TABLE "mensagem" ADD COLUMN     "aluno_id" UUID,
ADD COLUMN     "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "canal" TEXT NOT NULL,
ADD COLUMN     "contexto" TEXT,
ADD COLUMN     "direcao" TEXT NOT NULL,
ADD COLUMN     "estado" TEXT NOT NULL,
ADD COLUMN     "finalidade" TEXT,
ADD COLUMN     "id_externo" TEXT,
ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "texto" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "uso_de_ia" ADD COLUMN     "finalidade" TEXT NOT NULL,
ADD COLUMN     "provedor" TEXT NOT NULL,
ADD COLUMN     "tokens_entrada" INTEGER NOT NULL,
ADD COLUMN     "tokens_saida" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "conexao_meta_tenant_id_estado_expira_em_idx" ON "conexao_meta"("tenant_id", "estado", "expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "conexao_meta_tenant_id_canal_key" ON "conexao_meta"("tenant_id", "canal");

-- CreateIndex
CREATE INDEX "mensagem_tenant_id_id_externo_idx" ON "mensagem"("tenant_id", "id_externo");

-- CreateIndex
CREATE INDEX "mensagem_tenant_id_aluno_id_criado_em_idx" ON "mensagem"("tenant_id", "aluno_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "uso_de_ia_tenant_id_criado_em_idx" ON "uso_de_ia"("tenant_id", "criado_em");

