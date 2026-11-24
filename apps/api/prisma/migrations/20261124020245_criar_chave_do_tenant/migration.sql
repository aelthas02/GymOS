-- CreateTable
CREATE TABLE "chave_do_tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chave_do_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chave_do_tenant_tenant_id_idx" ON "chave_do_tenant"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "chave_do_tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chave_do_tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY "chave_do_tenant_isolamento_por_tenant" ON "chave_do_tenant"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "chave_do_tenant" TO gymos_app;
