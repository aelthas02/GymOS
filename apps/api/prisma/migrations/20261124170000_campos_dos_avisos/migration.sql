-- Campos do domínio avisos (T13e), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "aviso" ADD COLUMN     "destinatario_id" UUID NOT NULL,
ADD COLUMN     "destinatario_tipo" TEXT NOT NULL,
ADD COLUMN     "lido_em" TIMESTAMPTZ(3),
ADD COLUMN     "link" TEXT,
ADD COLUMN     "texto" TEXT NOT NULL,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "titulo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "aviso_agendado" ADD COLUMN     "chave" TEXT,
ADD COLUMN     "destinatario_id" UUID NOT NULL,
ADD COLUMN     "destinatario_tipo" TEXT NOT NULL,
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'pendente',
ADD COLUMN     "link" TEXT,
ADD COLUMN     "push" BOOLEAN NOT NULL,
ADD COLUMN     "quando" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "texto" TEXT NOT NULL,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "titulo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "inscricao_de_push" ADD COLUMN     "auth" TEXT NOT NULL,
ADD COLUMN     "destinatario_id" UUID NOT NULL,
ADD COLUMN     "destinatario_tipo" TEXT NOT NULL,
ADD COLUMN     "dispositivo" TEXT,
ADD COLUMN     "endpoint" TEXT NOT NULL,
ADD COLUMN     "p256dh" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "preferencia_de_aviso" ADD COLUMN     "destinatario_id" UUID NOT NULL,
ADD COLUMN     "destinatario_tipo" TEXT NOT NULL,
ADD COLUMN     "push" BOOLEAN NOT NULL,
ADD COLUMN     "tipo" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "aviso_tenant_id_destinatario_tipo_destinatario_id_criado_em_idx" ON "aviso"("tenant_id", "destinatario_tipo", "destinatario_id", "criado_em" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "aviso_tenant_id_destinatario_tipo_destinatario_id_lido_em_idx" ON "aviso"("tenant_id", "destinatario_tipo", "destinatario_id", "lido_em");

-- CreateIndex
CREATE INDEX "aviso_agendado_tenant_id_chave_estado_idx" ON "aviso_agendado"("tenant_id", "chave", "estado");

-- CreateIndex
CREATE INDEX "aviso_agendado_tenant_id_destinatario_tipo_destinatario_id_idx" ON "aviso_agendado"("tenant_id", "destinatario_tipo", "destinatario_id");

-- CreateIndex
CREATE INDEX "inscricao_de_push_tenant_id_destinatario_tipo_destinatario__idx" ON "inscricao_de_push"("tenant_id", "destinatario_tipo", "destinatario_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscricao_de_push_tenant_id_endpoint_key" ON "inscricao_de_push"("tenant_id", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "preferencia_de_aviso_tenant_id_destinatario_tipo_destinatar_key" ON "preferencia_de_aviso"("tenant_id", "destinatario_tipo", "destinatario_id", "tipo");

