-- Campos do domínio fiscal (T20), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "configuracao_fiscal" ADD COLUMN     "aliquota_iss_pontos_base" INTEGER NOT NULL,
ADD COLUMN     "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "certificado_validade" DATE,
ADD COLUMN     "cnpj" TEXT NOT NULL,
ADD COLUMN     "codigo_do_servico" TEXT NOT NULL,
ADD COLUMN     "emitir_em_lote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emitir_nfce_na_venda" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emitir_nfse_ao_confirmar" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "enviar_ao_aluno" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "municipio" TEXT NOT NULL,
ADD COLUMN     "razao_social" TEXT NOT NULL,
ADD COLUMN     "regime" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "nota_fiscal" ADD COLUMN     "aliquota_iss_pontos_base" INTEGER NOT NULL,
ADD COLUMN     "aluno_id" UUID,
ADD COLUMN     "anexar_arquivos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cancelada_em" TIMESTAMPTZ(3),
ADD COLUMN     "codigo_do_servico" TEXT NOT NULL,
ADD COLUMN     "competencia" TEXT NOT NULL,
ADD COLUMN     "descricao" TEXT NOT NULL,
ADD COLUMN     "emitida_em" TIMESTAMPTZ(3),
ADD COLUMN     "enviada_ao_aluno_em" TIMESTAMPTZ(3),
ADD COLUMN     "enviar_ao_aluno" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forma_de_pagamento" TEXT,
ADD COLUMN     "iss_centavos" INTEGER NOT NULL,
ADD COLUMN     "motivo_da_rejeicao" TEXT,
ADD COLUMN     "motivo_do_cancelamento" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "origem" TEXT,
ADD COLUMN     "pagamento_id" UUID,
ADD COLUMN     "parcela_id" UUID,
ADD COLUMN     "pdf_chave" TEXT,
ADD COLUMN     "registrada_na_ficha" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retencoes_centavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "situacao" TEXT NOT NULL,
ADD COLUMN     "tentativas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "tomador_cpf" TEXT,
ADD COLUMN     "tomador_nome" TEXT NOT NULL,
ADD COLUMN     "valor_centavos" INTEGER NOT NULL,
ADD COLUMN     "xml_chave" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "configuracao_fiscal_tenant_id_key" ON "configuracao_fiscal"("tenant_id");

-- CreateIndex
CREATE INDEX "nota_fiscal_tenant_id_competencia_criado_em_idx" ON "nota_fiscal"("tenant_id", "competencia", "criado_em");

-- CreateIndex
CREATE INDEX "nota_fiscal_tenant_id_situacao_idx" ON "nota_fiscal"("tenant_id", "situacao");

-- CreateIndex
CREATE INDEX "nota_fiscal_tenant_id_aluno_id_idx" ON "nota_fiscal"("tenant_id", "aluno_id");

-- CreateIndex
CREATE INDEX "nota_fiscal_tenant_id_parcela_id_idx" ON "nota_fiscal"("tenant_id", "parcela_id");

-- CreateIndex
CREATE UNIQUE INDEX "nota_fiscal_tenant_id_pagamento_id_tipo_key" ON "nota_fiscal"("tenant_id", "pagamento_id", "tipo");

