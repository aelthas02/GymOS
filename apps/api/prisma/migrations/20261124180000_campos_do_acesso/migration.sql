-- Campos do domínio acesso (T23a), gerados por prisma migrate diff.

-- AlterTable
ALTER TABLE "acesso" ADD COLUMN     "aluno_id" UUID,
ADD COLUMN     "dia" DATE NOT NULL,
ADD COLUMN     "direcao" TEXT NOT NULL,
ADD COLUMN     "dispositivo_id" UUID,
ADD COLUMN     "id_de_origem" UUID NOT NULL,
ADD COLUMN     "metodo" TEXT NOT NULL,
ADD COLUMN     "modalidade" TEXT,
ADD COLUMN     "motivo" TEXT,
ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "registrado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "registrado_por" UUID,
ADD COLUMN     "resultado" TEXT NOT NULL,
ADD COLUMN     "unidade_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "alerta_de_frequencia" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "dias_sem_treinar" INTEGER,
ADD COLUMN     "nivel" TEXT NOT NULL,
ADD COLUMN     "queda_percentual" INTEGER,
ADD COLUMN     "resolvido_em" TIMESTAMPTZ(3),
ADD COLUMN     "tipo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "chave_de_qr" ADD COLUMN     "ativa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chave_privada" TEXT NOT NULL,
ADD COLUMN     "chave_publica" TEXT NOT NULL,
ADD COLUMN     "revogada_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "configuracao_de_acesso" ADD COLUMN     "abertura" TEXT NOT NULL DEFAULT '05:00',
ADD COLUMN     "anti_passback" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bloqueio_por_atraso_dias" INTEGER DEFAULT 7,
ADD COLUMN     "fechamento" TEXT NOT NULL DEFAULT '23:00',
ADD COLUMN     "limite_por_dia" INTEGER DEFAULT 1;

-- AlterTable
ALTER TABLE "configuracao_de_alertas" ADD COLUMN     "destinatarios" TEXT[] DEFAULT ARRAY['professor', 'recepcao', 'gerencia']::TEXT[],
ADD COLUMN     "dias_sem_treinar" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "hora_da_verificacao" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN     "ignorar_ferias_e_trancados" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mensagem_ao_aluno" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "queda_percentual" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "ultima_verificacao_dia" DATE,
ADD COLUMN     "urgente_apos_dias" INTEGER NOT NULL DEFAULT 15;

-- AlterTable
ALTER TABLE "qr_usado" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "nonce" TEXT NOT NULL,
ADD COLUMN     "usado_em" TIMESTAMPTZ(3) NOT NULL;

-- CreateIndex
CREATE INDEX "acesso_tenant_id_aluno_id_registrado_em_idx" ON "acesso"("tenant_id", "aluno_id", "registrado_em" DESC);

-- CreateIndex
CREATE INDEX "acesso_tenant_id_dia_idx" ON "acesso"("tenant_id", "dia");

-- CreateIndex
CREATE INDEX "acesso_tenant_id_registrado_em_idx" ON "acesso"("tenant_id", "registrado_em");

-- CreateIndex
CREATE UNIQUE INDEX "acesso_tenant_id_id_de_origem_key" ON "acesso"("tenant_id", "id_de_origem");

-- CreateIndex
CREATE INDEX "alerta_de_frequencia_tenant_id_resolvido_em_idx" ON "alerta_de_frequencia"("tenant_id", "resolvido_em");

-- CreateIndex
CREATE INDEX "alerta_de_frequencia_tenant_id_aluno_id_tipo_resolvido_em_idx" ON "alerta_de_frequencia"("tenant_id", "aluno_id", "tipo", "resolvido_em");

-- CreateIndex
CREATE INDEX "chave_de_qr_tenant_id_ativa_idx" ON "chave_de_qr"("tenant_id", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_de_acesso_tenant_id_key" ON "configuracao_de_acesso"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_de_alertas_tenant_id_key" ON "configuracao_de_alertas"("tenant_id");

-- CreateIndex
CREATE INDEX "qr_usado_tenant_id_usado_em_idx" ON "qr_usado"("tenant_id", "usado_em");

-- CreateIndex
CREATE UNIQUE INDEX "qr_usado_tenant_id_nonce_key" ON "qr_usado"("tenant_id", "nonce");

