-- CreateTable
CREATE TABLE "comando_do_agente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comando_do_agente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comando_do_agente_tenant_id_idx" ON "comando_do_agente"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "comando_do_agente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comando_do_agente" FORCE ROW LEVEL SECURITY;
CREATE POLICY "comando_do_agente_isolamento_por_tenant" ON "comando_do_agente"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "comando_do_agente" TO gymos_app;
