-- CreateTable
CREATE TABLE "aviso_agendado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_agendado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aviso_agendado_tenant_id_idx" ON "aviso_agendado"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "aviso_agendado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aviso_agendado" FORCE ROW LEVEL SECURITY;
CREATE POLICY "aviso_agendado_isolamento_por_tenant" ON "aviso_agendado"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "aviso_agendado" TO gymos_app;
