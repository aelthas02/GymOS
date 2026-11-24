-- CreateTable
CREATE TABLE "funcionario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funcionario_tenant_id_idx" ON "funcionario"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "funcionario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "funcionario" FORCE ROW LEVEL SECURITY;
CREATE POLICY "funcionario_isolamento_por_tenant" ON "funcionario"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "funcionario" TO gymos_app;
