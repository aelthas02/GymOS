-- CreateTable
CREATE TABLE "cadastro_biometrico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cadastro_biometrico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cadastro_biometrico_tenant_id_idx" ON "cadastro_biometrico"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "cadastro_biometrico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cadastro_biometrico" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cadastro_biometrico_isolamento_por_tenant" ON "cadastro_biometrico"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "cadastro_biometrico" TO gymos_app;
