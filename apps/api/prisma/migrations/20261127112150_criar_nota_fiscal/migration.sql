-- CreateTable
CREATE TABLE "nota_fiscal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_fiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nota_fiscal_tenant_id_idx" ON "nota_fiscal"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "nota_fiscal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nota_fiscal" FORCE ROW LEVEL SECURITY;
CREATE POLICY "nota_fiscal_isolamento_por_tenant" ON "nota_fiscal"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "nota_fiscal" TO gymos_app;
