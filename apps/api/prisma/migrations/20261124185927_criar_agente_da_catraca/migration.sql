-- CreateTable
CREATE TABLE "agente_da_catraca" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agente_da_catraca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agente_da_catraca_tenant_id_idx" ON "agente_da_catraca"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "agente_da_catraca" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agente_da_catraca" FORCE ROW LEVEL SECURITY;
CREATE POLICY "agente_da_catraca_isolamento_por_tenant" ON "agente_da_catraca"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "agente_da_catraca" TO gymos_app;
