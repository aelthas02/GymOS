-- CreateTable
CREATE TABLE "inscricao_de_push" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricao_de_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inscricao_de_push_tenant_id_idx" ON "inscricao_de_push"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "inscricao_de_push" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inscricao_de_push" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inscricao_de_push_isolamento_por_tenant" ON "inscricao_de_push"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "inscricao_de_push" TO gymos_app;
