-- CreateTable
CREATE TABLE "acesso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acesso_tenant_id_idx" ON "acesso"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "acesso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "acesso" FORCE ROW LEVEL SECURITY;
CREATE POLICY "acesso_isolamento_por_tenant" ON "acesso"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "acesso" TO gymos_app;
