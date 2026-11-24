-- Campos do domínio cobrança (T19), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "cobranca" ADD COLUMN     "aluno_id" UUID,
ADD COLUMN     "dados" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "forma" TEXT NOT NULL,
ADD COLUMN     "id_externo" TEXT NOT NULL,
ADD COLUMN     "parcela_id" UUID,
ADD COLUMN     "provedor" TEXT NOT NULL,
ADD COLUMN     "situacao" TEXT NOT NULL,
ADD COLUMN     "valor_centavos" INTEGER NOT NULL,
ADD COLUMN     "vencimento" DATE NOT NULL;

-- AlterTable
ALTER TABLE "estorno" ADD COLUMN     "estornado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "id_evento_externo" TEXT,
ADD COLUMN     "motivo" TEXT NOT NULL,
ADD COLUMN     "pagamento_id" UUID NOT NULL,
ADD COLUMN     "provedor" TEXT,
ADD COLUMN     "valor_centavos" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "forma_de_pagamento" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "final_do_cartao" TEXT,
ADD COLUMN     "forma" TEXT NOT NULL,
ADD COLUMN     "token_do_cartao" TEXT;

-- AlterTable
ALTER TABLE "pagamento" ADD COLUMN     "aluno_id" UUID,
ADD COLUMN     "canal" TEXT NOT NULL,
ADD COLUMN     "cobranca_id" UUID,
ADD COLUMN     "confirmado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "contrato_id" UUID,
ADD COLUMN     "em_duplicidade" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estornado_centavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "forma" TEXT NOT NULL,
ADD COLUMN     "id_evento_externo" TEXT,
ADD COLUMN     "origem" TEXT NOT NULL,
ADD COLUMN     "parcela_id" UUID,
ADD COLUMN     "provedor" TEXT,
ADD COLUMN     "setor" TEXT NOT NULL,
ADD COLUMN     "situacao" TEXT NOT NULL,
ADD COLUMN     "taxa_centavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "valor_centavos" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "parcela" ADD COLUMN     "aluno_id" UUID,
ADD COLUMN     "contrato_id" UUID NOT NULL,
ADD COLUMN     "numero" INTEGER NOT NULL,
ADD COLUMN     "pago_centavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "periodo" DATE NOT NULL,
ADD COLUMN     "situacao" TEXT NOT NULL,
ADD COLUMN     "suspensa_desde" DATE,
ADD COLUMN     "total_de_parcelas" INTEGER NOT NULL,
ADD COLUMN     "valor_centavos" INTEGER NOT NULL,
ADD COLUMN     "vencimento" DATE NOT NULL,
ADD COLUMN     "vencimento_original" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "cobranca_tenant_id_parcela_id_idx" ON "cobranca"("tenant_id", "parcela_id");

-- CreateIndex
CREATE UNIQUE INDEX "cobranca_tenant_id_id_key" ON "cobranca"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "cobranca_provedor_id_externo_key" ON "cobranca"("provedor", "id_externo");

-- CreateIndex
CREATE INDEX "estorno_tenant_id_pagamento_id_idx" ON "estorno"("tenant_id", "pagamento_id");

-- CreateIndex
CREATE UNIQUE INDEX "estorno_tenant_id_provedor_id_evento_externo_key" ON "estorno"("tenant_id", "provedor", "id_evento_externo");

-- CreateIndex
CREATE UNIQUE INDEX "forma_de_pagamento_tenant_id_aluno_id_key" ON "forma_de_pagamento"("tenant_id", "aluno_id");

-- CreateIndex
CREATE INDEX "pagamento_tenant_id_aluno_id_confirmado_em_idx" ON "pagamento"("tenant_id", "aluno_id", "confirmado_em");

-- CreateIndex
CREATE INDEX "pagamento_tenant_id_parcela_id_idx" ON "pagamento"("tenant_id", "parcela_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_tenant_id_id_key" ON "pagamento"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "pagamento_tenant_id_provedor_id_evento_externo_key" ON "pagamento"("tenant_id", "provedor", "id_evento_externo");

-- CreateIndex
CREATE INDEX "parcela_tenant_id_aluno_id_vencimento_idx" ON "parcela"("tenant_id", "aluno_id", "vencimento");

-- CreateIndex
CREATE INDEX "parcela_tenant_id_situacao_vencimento_idx" ON "parcela"("tenant_id", "situacao", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_tenant_id_id_key" ON "parcela"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_tenant_id_contrato_id_periodo_numero_key" ON "parcela"("tenant_id", "contrato_id", "periodo", "numero");

