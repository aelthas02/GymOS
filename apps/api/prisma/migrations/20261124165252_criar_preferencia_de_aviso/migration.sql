-- CreateTable
CREATE TABLE "preferencia_de_aviso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preferencia_de_aviso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preferencia_de_aviso_tenant_id_idx" ON "preferencia_de_aviso"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "preferencia_de_aviso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "preferencia_de_aviso" FORCE ROW LEVEL SECURITY;
CREATE POLICY "preferencia_de_aviso_isolamento_por_tenant" ON "preferencia_de_aviso"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "preferencia_de_aviso" TO gymos_app;
