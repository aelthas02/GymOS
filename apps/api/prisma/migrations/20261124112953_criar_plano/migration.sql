-- CreateTable
CREATE TABLE "plano" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plano_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plano_tenant_id_idx" ON "plano"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "plano" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plano" FORCE ROW LEVEL SECURITY;
CREATE POLICY "plano_isolamento_por_tenant" ON "plano"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "plano" TO gymos_app;
