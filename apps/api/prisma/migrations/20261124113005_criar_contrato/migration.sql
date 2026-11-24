-- CreateTable
CREATE TABLE "contrato" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contrato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contrato_tenant_id_idx" ON "contrato"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "contrato" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contrato" FORCE ROW LEVEL SECURITY;
CREATE POLICY "contrato_isolamento_por_tenant" ON "contrato"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "contrato" TO gymos_app;
