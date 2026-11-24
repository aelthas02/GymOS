-- CreateTable
CREATE TABLE "estorno" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estorno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estorno_tenant_id_idx" ON "estorno"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "estorno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "estorno" FORCE ROW LEVEL SECURITY;
CREATE POLICY "estorno_isolamento_por_tenant" ON "estorno"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "estorno" TO gymos_app;
