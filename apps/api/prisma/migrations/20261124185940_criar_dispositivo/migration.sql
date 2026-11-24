-- CreateTable
CREATE TABLE "dispositivo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispositivo_tenant_id_idx" ON "dispositivo"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "dispositivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dispositivo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "dispositivo_isolamento_por_tenant" ON "dispositivo"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "dispositivo" TO gymos_app;
