-- CreateTable
CREATE TABLE "parcela" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "parcela_tenant_id_idx" ON "parcela"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "parcela" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parcela" FORCE ROW LEVEL SECURITY;
CREATE POLICY "parcela_isolamento_por_tenant" ON "parcela"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "parcela" TO gymos_app;
