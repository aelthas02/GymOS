-- CreateTable
CREATE TABLE "alteracao_do_cache_de_acesso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alteracao_do_cache_de_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alteracao_do_cache_de_acesso_tenant_id_idx" ON "alteracao_do_cache_de_acesso"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "alteracao_do_cache_de_acesso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alteracao_do_cache_de_acesso" FORCE ROW LEVEL SECURITY;
CREATE POLICY "alteracao_do_cache_de_acesso_isolamento_por_tenant" ON "alteracao_do_cache_de_acesso"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "alteracao_do_cache_de_acesso" TO gymos_app;
