-- CreateTable
CREATE TABLE "atividade" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "atividade_tenant_id_idx" ON "atividade"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "atividade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "atividade" FORCE ROW LEVEL SECURITY;
CREATE POLICY "atividade_isolamento_por_tenant" ON "atividade"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "atividade" TO gymos_app;
