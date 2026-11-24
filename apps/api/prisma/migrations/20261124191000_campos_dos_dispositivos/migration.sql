-- Campos do domínio dispositivos (T23b), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "agente_da_catraca" ADD COLUMN     "credencial_gerada_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "credencial_hash" TEXT NOT NULL,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "revogado_em" TIMESTAMPTZ(3),
ADD COLUMN     "ultima_sincronizacao_em" TIMESTAMPTZ(3),
ADD COLUMN     "ultimo_batimento_em" TIMESTAMPTZ(3),
ADD COLUMN     "versao_do_agente" TEXT;

-- AlterTable
ALTER TABLE "alteracao_do_cache_de_acesso" ADD COLUMN     "alterado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "aluno_id" UUID,
ADD COLUMN     "chave" TEXT NOT NULL,
ADD COLUMN     "versao" BIGSERIAL NOT NULL;

-- AlterTable
ALTER TABLE "cadastro_biometrico" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "comando_id" UUID,
ADD COLUMN     "dispositivo_id" UUID,
ADD COLUMN     "referencia" TEXT,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "tipo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "codigo_de_pareamento" ADD COLUMN     "agente_id" UUID,
ADD COLUMN     "codigo" TEXT NOT NULL,
ADD COLUMN     "criado_por" UUID,
ADD COLUMN     "expira_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "usado_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "comando_do_agente" ADD COLUMN     "agente_id" UUID NOT NULL,
ADD COLUMN     "dados" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "dispositivo_id" UUID,
ADD COLUMN     "entregue_em" TIMESTAMPTZ(3),
ADD COLUMN     "expira_em" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "respondido_em" TIMESTAMPTZ(3),
ADD COLUMN     "resposta" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pendente',
ADD COLUMN     "tipo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "dispositivo" ADD COLUMN     "agente_id" UUID,
ADD COLUMN     "local" TEXT NOT NULL,
ADD COLUMN     "metodos" TEXT[],
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "online" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo" TEXT NOT NULL,
ADD COLUMN     "ultimo_batimento_em" TIMESTAMPTZ(3),
ADD COLUMN     "unidade_id" UUID;

-- AlterTable
ALTER TABLE "queda_de_dispositivo" ADD COLUMN     "desde" TIMESTAMPTZ(3) NOT NULL,
ADD COLUMN     "dispositivo_id" UUID NOT NULL,
ADD COLUMN     "voltou_em" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "alteracao_do_cache_de_acesso_tenant_id_versao_idx" ON "alteracao_do_cache_de_acesso"("tenant_id", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "alteracao_do_cache_de_acesso_tenant_id_chave_key" ON "alteracao_do_cache_de_acesso"("tenant_id", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "cadastro_biometrico_tenant_id_aluno_id_tipo_key" ON "cadastro_biometrico"("tenant_id", "aluno_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "codigo_de_pareamento_tenant_id_codigo_key" ON "codigo_de_pareamento"("tenant_id", "codigo");

-- CreateIndex
CREATE INDEX "comando_do_agente_tenant_id_agente_id_status_idx" ON "comando_do_agente"("tenant_id", "agente_id", "status");

-- CreateIndex
CREATE INDEX "dispositivo_tenant_id_agente_id_idx" ON "dispositivo"("tenant_id", "agente_id");

-- CreateIndex
CREATE INDEX "queda_de_dispositivo_tenant_id_dispositivo_id_voltou_em_idx" ON "queda_de_dispositivo"("tenant_id", "dispositivo_id", "voltou_em");

-- CreateIndex
CREATE INDEX "queda_de_dispositivo_tenant_id_desde_idx" ON "queda_de_dispositivo"("tenant_id", "desde");


-- A sequência da versão (BIGSERIAL) precisa de permissão própria para o gymos_app inserir.
GRANT USAGE ON SEQUENCE "alteracao_do_cache_de_acesso_versao_seq" TO gymos_app;
