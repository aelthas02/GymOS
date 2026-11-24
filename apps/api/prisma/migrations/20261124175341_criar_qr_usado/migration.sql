-- CreateTable
CREATE TABLE "qr_usado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_usado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qr_usado_tenant_id_idx" ON "qr_usado"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "qr_usado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qr_usado" FORCE ROW LEVEL SECURITY;
CREATE POLICY "qr_usado_isolamento_por_tenant" ON "qr_usado"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "qr_usado" TO gymos_app;
