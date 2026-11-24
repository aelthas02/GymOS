-- CreateTable
CREATE TABLE "consentimento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consentimento_tenant_id_idx" ON "consentimento"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "consentimento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consentimento" FORCE ROW LEVEL SECURITY;
CREATE POLICY "consentimento_isolamento_por_tenant" ON "consentimento"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "consentimento" TO gymos_app;
