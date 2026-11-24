-- CreateTable
CREATE TABLE "cobranca" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobranca_tenant_id_idx" ON "cobranca"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "cobranca" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cobranca" FORCE ROW LEVEL SECURITY;
CREATE POLICY "cobranca_isolamento_por_tenant" ON "cobranca"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "cobranca" TO gymos_app;
