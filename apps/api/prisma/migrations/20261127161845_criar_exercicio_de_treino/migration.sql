-- CreateTable
CREATE TABLE "exercicio_de_treino" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercicio_de_treino_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exercicio_de_treino_tenant_id_idx" ON "exercicio_de_treino"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "exercicio_de_treino" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exercicio_de_treino" FORCE ROW LEVEL SECURITY;
CREATE POLICY "exercicio_de_treino_isolamento_por_tenant" ON "exercicio_de_treino"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "exercicio_de_treino" TO gymos_app;
