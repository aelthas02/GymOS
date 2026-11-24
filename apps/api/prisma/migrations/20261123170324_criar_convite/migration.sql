-- CreateTable
CREATE TABLE "convite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "convite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "convite_tenant_id_idx" ON "convite"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "convite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "convite" FORCE ROW LEVEL SECURITY;
CREATE POLICY "convite_isolamento_por_tenant" ON "convite"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "convite" TO gymos_app;
