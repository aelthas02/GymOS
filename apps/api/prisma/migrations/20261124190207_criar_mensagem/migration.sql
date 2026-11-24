-- CreateTable
CREATE TABLE "mensagem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mensagem_tenant_id_idx" ON "mensagem"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "mensagem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mensagem" FORCE ROW LEVEL SECURITY;
CREATE POLICY "mensagem_isolamento_por_tenant" ON "mensagem"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "mensagem" TO gymos_app;
