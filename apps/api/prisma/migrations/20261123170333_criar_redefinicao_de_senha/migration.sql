-- CreateTable
CREATE TABLE "redefinicao_de_senha" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redefinicao_de_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "redefinicao_de_senha_tenant_id_idx" ON "redefinicao_de_senha"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "redefinicao_de_senha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "redefinicao_de_senha" FORCE ROW LEVEL SECURITY;
CREATE POLICY "redefinicao_de_senha_isolamento_por_tenant" ON "redefinicao_de_senha"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "redefinicao_de_senha" TO gymos_app;
