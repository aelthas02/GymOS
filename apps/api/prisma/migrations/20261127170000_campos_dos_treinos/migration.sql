-- Campos do domínio treinos (T25), gerados por prisma migrate diff.
-- AlterTable
ALTER TABLE "exercicio_de_treino" ADD COLUMN     "equipamento" TEXT NOT NULL,
ADD COLUMN     "grupo_muscular" TEXT NOT NULL,
ADD COLUMN     "instrucoes" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "video_url" TEXT;

-- AlterTable
ALTER TABLE "modelo_de_treino" ADD COLUMN     "dias_por_semana" INTEGER NOT NULL,
ADD COLUMN     "divisao" TEXT NOT NULL,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "treinos" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "ficha_de_treino" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "aprovada_em" TIMESTAMPTZ(3),
ADD COLUMN     "aprovada_por_id" UUID,
ADD COLUMN     "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "divisao" TEXT NOT NULL,
ADD COLUMN     "frequencia_semanal" INTEGER NOT NULL,
ADD COLUMN     "nivel" TEXT NOT NULL,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "objetivo" TEXT NOT NULL,
ADD COLUMN     "origem" TEXT NOT NULL,
ADD COLUMN     "professor_id" UUID,
ADD COLUMN     "restricoes" TEXT,
ADD COLUMN     "situacao" TEXT NOT NULL,
ADD COLUMN     "treinos" JSONB NOT NULL,
ADD COLUMN     "valida_ate" DATE;

-- AlterTable
ALTER TABLE "execucao_de_treino" ADD COLUMN     "aluno_id" UUID NOT NULL,
ADD COLUMN     "carga_kg" DOUBLE PRECISION,
ADD COLUMN     "esforco" INTEGER NOT NULL,
ADD COLUMN     "exercicio" TEXT NOT NULL,
ADD COLUMN     "ficha_id" UUID,
ADD COLUMN     "realizado_em" TIMESTAMPTZ(3) NOT NULL;

-- CreateIndex
CREATE INDEX "exercicio_de_treino_tenant_id_grupo_muscular_idx" ON "exercicio_de_treino"("tenant_id", "grupo_muscular");

-- CreateIndex
CREATE UNIQUE INDEX "exercicio_de_treino_tenant_id_nome_key" ON "exercicio_de_treino"("tenant_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "modelo_de_treino_tenant_id_nome_key" ON "modelo_de_treino"("tenant_id", "nome");

-- CreateIndex
CREATE INDEX "ficha_de_treino_tenant_id_aluno_id_situacao_idx" ON "ficha_de_treino"("tenant_id", "aluno_id", "situacao");

-- CreateIndex
CREATE INDEX "ficha_de_treino_tenant_id_situacao_idx" ON "ficha_de_treino"("tenant_id", "situacao");

-- CreateIndex
CREATE UNIQUE INDEX "ficha_de_treino_tenant_id_id_key" ON "ficha_de_treino"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "execucao_de_treino_tenant_id_aluno_id_realizado_em_idx" ON "execucao_de_treino"("tenant_id", "aluno_id", "realizado_em");
