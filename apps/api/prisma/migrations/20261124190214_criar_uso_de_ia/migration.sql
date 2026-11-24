-- CreateTable
CREATE TABLE "uso_de_ia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_de_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uso_de_ia_tenant_id_idx" ON "uso_de_ia"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "uso_de_ia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "uso_de_ia" FORCE ROW LEVEL SECURITY;
CREATE POLICY "uso_de_ia_isolamento_por_tenant" ON "uso_de_ia"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "uso_de_ia" TO gymos_app;
