-- CreateTable
CREATE TABLE "codigo_de_pareamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_de_pareamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigo_de_pareamento_tenant_id_idx" ON "codigo_de_pareamento"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "codigo_de_pareamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "codigo_de_pareamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY "codigo_de_pareamento_isolamento_por_tenant" ON "codigo_de_pareamento"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "codigo_de_pareamento" TO gymos_app;
