-- CreateTable
CREATE TABLE "token_de_refresh" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_de_refresh_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_de_refresh_tenant_id_idx" ON "token_de_refresh"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "token_de_refresh" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "token_de_refresh" FORCE ROW LEVEL SECURITY;
CREATE POLICY "token_de_refresh_isolamento_por_tenant" ON "token_de_refresh"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "token_de_refresh" TO gymos_app;
