-- CreateTable
CREATE TABLE "queda_de_dispositivo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queda_de_dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "queda_de_dispositivo_tenant_id_idx" ON "queda_de_dispositivo"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "queda_de_dispositivo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "queda_de_dispositivo" FORCE ROW LEVEL SECURITY;
CREATE POLICY "queda_de_dispositivo_isolamento_por_tenant" ON "queda_de_dispositivo"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "queda_de_dispositivo" TO gymos_app;
