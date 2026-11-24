-- CreateTable
CREATE TABLE "chave_de_qr" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chave_de_qr_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chave_de_qr_tenant_id_idx" ON "chave_de_qr"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "chave_de_qr" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chave_de_qr" FORCE ROW LEVEL SECURITY;
CREATE POLICY "chave_de_qr_isolamento_por_tenant" ON "chave_de_qr"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "chave_de_qr" TO gymos_app;
