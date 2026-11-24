-- CreateTable
CREATE TABLE "acesso_a_dado_sensivel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acesso_a_dado_sensivel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acesso_a_dado_sensivel_tenant_id_idx" ON "acesso_a_dado_sensivel"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "acesso_a_dado_sensivel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "acesso_a_dado_sensivel" FORCE ROW LEVEL SECURITY;
CREATE POLICY "acesso_a_dado_sensivel_isolamento_por_tenant" ON "acesso_a_dado_sensivel"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "acesso_a_dado_sensivel" TO gymos_app;
