-- CreateTable
CREATE TABLE "pagamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagamento_tenant_id_idx" ON "pagamento"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "pagamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pagamento_isolamento_por_tenant" ON "pagamento"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "pagamento" TO gymos_app;
