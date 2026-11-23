-- Plataforma multi-tenant (ADR-003). Roda como gymos_migrator, dono das tabelas. Os papéis
-- gymos_migrator e gymos_app são criados fora das migrações (`pnpm gymos preparar-banco`).

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor_destaque" TEXT NOT NULL,
    "logotipo_url" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'base',
    "configurada" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referencia_externa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "provedor" TEXT NOT NULL,
    "id_externo" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recurso_id" UUID NOT NULL,
    "ultimo_evento" TEXT,
    "ultimo_evento_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referencia_externa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "unidade_tenant_id_idx" ON "unidade"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidade_tenant_id_id_key" ON "unidade"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "referencia_externa_tenant_id_recurso_recurso_id_idx" ON "referencia_externa"("tenant_id", "recurso", "recurso_id");

-- CreateIndex
CREATE UNIQUE INDEX "referencia_externa_provedor_id_externo_key" ON "referencia_externa"("provedor", "id_externo");

-- AddForeignKey
ALTER TABLE "unidade" ADD CONSTRAINT "unidade_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referencia_externa" ADD CONSTRAINT "referencia_externa_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant: fora da convenção de RLS. O gymos_app não tem acesso direto; lê e escreve pelas funções.
REVOKE ALL ON "tenant" FROM PUBLIC;

-- Convenção de tabela: RLS forçado e isolamento pela variável de transação app.tenant_id.
ALTER TABLE "unidade" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unidade" FORCE ROW LEVEL SECURITY;
CREATE POLICY "unidade_isolamento_por_tenant" ON "unidade"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "unidade" TO gymos_app;

ALTER TABLE "referencia_externa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referencia_externa" FORCE ROW LEVEL SECURITY;
CREATE POLICY "referencia_externa_isolamento_por_tenant" ON "referencia_externa"
    USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
-- Só leitura, só para o dono: é o que a função SECURITY DEFINER abaixo usa para achar o tenant de
-- um webhook sem contexto. O gymos_app continua preso à política de isolamento.
CREATE POLICY "referencia_externa_resolucao_pela_plataforma" ON "referencia_externa"
    FOR SELECT TO gymos_migrator USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON "referencia_externa" TO gymos_app;

-- Funções da plataforma: SECURITY DEFINER (rodam como gymos_migrator) com search_path fixo.
CREATE FUNCTION gymos_tenant_por_slug(p_slug TEXT)
RETURNS TABLE (id UUID, slug TEXT, nome TEXT, cor_destaque TEXT, logotipo_url TEXT, plano TEXT, configurada BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT t.id, t.slug, t.nome, t.cor_destaque, t.logotipo_url, t.plano, t.configurada
    FROM tenant t WHERE t.slug = p_slug
$$;

CREATE FUNCTION gymos_tenant_por_id(p_id UUID)
RETURNS TABLE (id UUID, slug TEXT, nome TEXT, cor_destaque TEXT, logotipo_url TEXT, plano TEXT, configurada BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT t.id, t.slug, t.nome, t.cor_destaque, t.logotipo_url, t.plano, t.configurada
    FROM tenant t WHERE t.id = p_id
$$;

-- Jobs "para todos os tenants" iteram esta lista e chamam runAsTenant por tenant.
CREATE FUNCTION gymos_listar_tenants()
RETURNS TABLE (id UUID, slug TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT t.id, t.slug FROM tenant t ORDER BY t.slug
$$;

CREATE FUNCTION gymos_criar_tenant(p_slug TEXT, p_nome TEXT, p_cor_destaque TEXT, p_logotipo_url TEXT, p_plano TEXT)
RETURNS UUID
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    INSERT INTO tenant (slug, nome, cor_destaque, logotipo_url, plano)
    VALUES (p_slug, p_nome, p_cor_destaque, p_logotipo_url, p_plano)
    RETURNING id
$$;

-- Atualiza só o tenant do contexto (app.tenant_id); sem contexto, falha.
CREATE FUNCTION gymos_atualizar_identidade_do_tenant(p_nome TEXT, p_cor_destaque TEXT, p_logotipo_url TEXT)
RETURNS TABLE (id UUID, slug TEXT, nome TEXT, cor_destaque TEXT, logotipo_url TEXT, plano TEXT, configurada BOOLEAN)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_tenant UUID := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
    IF v_tenant IS NULL THEN
        RAISE EXCEPTION 'app.tenant_id não definido' USING ERRCODE = '42501';
    END IF;
    RETURN QUERY
        UPDATE tenant t
        SET nome = p_nome, cor_destaque = p_cor_destaque, logotipo_url = p_logotipo_url
        WHERE t.id = v_tenant
        RETURNING t.id, t.slug, t.nome, t.cor_destaque, t.logotipo_url, t.plano, t.configurada;
END
$$;

-- Webhooks que não carregam o tenant: (provedor, id_externo) → tenant_id.
CREATE FUNCTION gymos_tenant_da_referencia_externa(p_provedor TEXT, p_id_externo TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
    SELECT r.tenant_id FROM referencia_externa r
    WHERE r.provedor = p_provedor AND r.id_externo = p_id_externo
$$;

REVOKE ALL ON FUNCTION gymos_tenant_por_slug(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION gymos_tenant_por_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION gymos_listar_tenants() FROM PUBLIC;
REVOKE ALL ON FUNCTION gymos_criar_tenant(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION gymos_atualizar_identidade_do_tenant(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION gymos_tenant_da_referencia_externa(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION gymos_tenant_por_slug(TEXT) TO gymos_app;
GRANT EXECUTE ON FUNCTION gymos_tenant_por_id(UUID) TO gymos_app;
GRANT EXECUTE ON FUNCTION gymos_listar_tenants() TO gymos_app;
GRANT EXECUTE ON FUNCTION gymos_criar_tenant(TEXT, TEXT, TEXT, TEXT, TEXT) TO gymos_app;
GRANT EXECUTE ON FUNCTION gymos_atualizar_identidade_do_tenant(TEXT, TEXT, TEXT) TO gymos_app;
GRANT EXECUTE ON FUNCTION gymos_tenant_da_referencia_externa(TEXT, TEXT) TO gymos_app;
