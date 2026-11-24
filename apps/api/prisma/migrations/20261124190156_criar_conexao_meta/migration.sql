-- CreateTable
CREATE TABLE "conexao_meta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conexao_meta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conexao_meta_tenant_id_idx" ON "conexao_meta"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "conexao_meta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conexao_meta" FORCE ROW LEVEL SECURITY;
CREATE POLICY "conexao_meta_isolamento_por_tenant" ON "conexao_meta"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "conexao_meta" TO gymos_app;
