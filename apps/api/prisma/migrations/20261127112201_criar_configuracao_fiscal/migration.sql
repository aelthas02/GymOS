-- CreateTable
CREATE TABLE "configuracao_fiscal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracao_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "configuracao_fiscal_tenant_id_idx" ON "configuracao_fiscal"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "configuracao_fiscal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "configuracao_fiscal" FORCE ROW LEVEL SECURITY;
CREATE POLICY "configuracao_fiscal_isolamento_por_tenant" ON "configuracao_fiscal"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "configuracao_fiscal" TO gymos_app;
