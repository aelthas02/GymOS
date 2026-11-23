-- CreateTable
CREATE TABLE "tipo_de_acesso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipo_de_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tipo_de_acesso_tenant_id_idx" ON "tipo_de_acesso"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "tipo_de_acesso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tipo_de_acesso" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tipo_de_acesso_isolamento_por_tenant" ON "tipo_de_acesso"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "tipo_de_acesso" TO gymos_app;
