-- CreateTable
CREATE TABLE "credencial_aluno" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credencial_aluno_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credencial_aluno_tenant_id_idx" ON "credencial_aluno"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "credencial_aluno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "credencial_aluno" FORCE ROW LEVEL SECURITY;
CREATE POLICY "credencial_aluno_isolamento_por_tenant" ON "credencial_aluno"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "credencial_aluno" TO gymos_app;
