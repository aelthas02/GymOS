-- Eventos de domínio (ADR-007, T13a): outbox transacional e marca de idempotência dos consumidores.

-- CreateTable
CREATE TABLE "evento_outbox" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "ocorrido_em" TIMESTAMPTZ(3) NOT NULL,
    "publicado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_processado" (
    "consumidor" TEXT NOT NULL,
    "evento_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "processado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_processado_pkey" PRIMARY KEY ("consumidor","evento_id")
);

-- CreateIndex
CREATE INDEX "evento_outbox_tenant_id_idx" ON "evento_outbox"("tenant_id");

-- CreateIndex
CREATE INDEX "evento_outbox_publicado_em_criado_em_idx" ON "evento_outbox"("publicado_em", "criado_em");

-- CreateIndex
CREATE INDEX "evento_processado_tenant_id_idx" ON "evento_processado"("tenant_id");

-- Convenção de tabela (ADR-003): RLS forçado, isolamento por app.tenant_id e DML do gymos_app.
ALTER TABLE "evento_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evento_outbox" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evento_outbox_isolamento_por_tenant" ON "evento_outbox"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
-- O despachante lê todos os tenants: só o dono, pelas funções SECURITY DEFINER abaixo. O gymos_app
-- continua preso à política de isolamento.
CREATE POLICY "evento_outbox_despacho_leitura" ON "evento_outbox"
    FOR SELECT TO gymos_migrator USING (true);
CREATE POLICY "evento_outbox_despacho_marcacao" ON "evento_outbox"
    FOR UPDATE TO gymos_migrator USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON "evento_outbox" TO gymos_app;

ALTER TABLE "evento_processado" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evento_processado" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evento_processado_isolamento_por_tenant" ON "evento_processado"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "evento_processado" TO gymos_app;

-- Reserva um lote de eventos não publicados de qualquer tenant. As linhas ficam travadas até o fim da
-- transação de quem chamou; outro despachante pula as travadas (SKIP LOCKED) e pega o lote seguinte.
CREATE FUNCTION gymos_outbox_reservar_lote(p_limite INTEGER)
RETURNS TABLE (id UUID, tenant_id UUID, tipo TEXT, versao INTEGER, payload JSONB, ocorrido_em TIMESTAMPTZ)
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT o.id, o.tenant_id, o.tipo, o.versao, o.payload, o.ocorrido_em
    FROM evento_outbox o
    WHERE o.publicado_em IS NULL
    ORDER BY o.criado_em, o.id
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
$$;

CREATE FUNCTION gymos_outbox_marcar_publicados(p_ids UUID[], p_instante TIMESTAMPTZ)
RETURNS INTEGER
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    WITH marcados AS (
        UPDATE evento_outbox SET publicado_em = p_instante
        WHERE id = ANY(p_ids) AND publicado_em IS NULL
        RETURNING 1
    )
    SELECT count(*)::integer FROM marcados
$$;

REVOKE ALL ON FUNCTION gymos_outbox_reservar_lote(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION gymos_outbox_marcar_publicados(UUID[], TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gymos_outbox_reservar_lote(INTEGER) TO gymos_app;
GRANT EXECUTE ON FUNCTION gymos_outbox_marcar_publicados(UUID[], TIMESTAMPTZ) TO gymos_app;
