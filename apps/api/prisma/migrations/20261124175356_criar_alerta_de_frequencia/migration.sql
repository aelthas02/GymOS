-- CreateTable
CREATE TABLE "alerta_de_frequencia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_de_frequencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerta_de_frequencia_tenant_id_idx" ON "alerta_de_frequencia"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "alerta_de_frequencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerta_de_frequencia" FORCE ROW LEVEL SECURITY;
CREATE POLICY "alerta_de_frequencia_isolamento_por_tenant" ON "alerta_de_frequencia"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "alerta_de_frequencia" TO gymos_app;
