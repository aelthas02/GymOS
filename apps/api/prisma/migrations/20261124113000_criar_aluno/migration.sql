-- CreateTable
CREATE TABLE "aluno" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aluno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aluno_tenant_id_idx" ON "aluno"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "aluno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aluno" FORCE ROW LEVEL SECURITY;
CREATE POLICY "aluno_isolamento_por_tenant" ON "aluno"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "aluno" TO gymos_app;
