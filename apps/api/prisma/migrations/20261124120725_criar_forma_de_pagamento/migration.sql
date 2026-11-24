-- CreateTable
CREATE TABLE "forma_de_pagamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forma_de_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forma_de_pagamento_tenant_id_idx" ON "forma_de_pagamento"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "forma_de_pagamento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "forma_de_pagamento" FORCE ROW LEVEL SECURITY;
CREATE POLICY "forma_de_pagamento_isolamento_por_tenant" ON "forma_de_pagamento"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "forma_de_pagamento" TO gymos_app;
