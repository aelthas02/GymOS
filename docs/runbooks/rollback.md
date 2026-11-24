# Rollback de imagem e de migração

Vale para staging e produção. O deploy passa por `tools/deploy/deploy.sh <ambiente> <tag>`, então o
rollback de imagem é um deploy de uma tag anterior. O provedor ainda não foi escolhido (ADR-017):
enquanto isso o deploy fica desabilitado e o ensaio é feito no CI (job `portoes`).

## Regra de ouro: migrar em duas fases

Migração destrutiva (remover coluna ou tabela, mudar tipo) nunca vai junto com o código que deixa de
usá-la. Ordem: **expandir** (adicionar, aceitar os dois formatos) → trocar a imagem → **contrair** em
outro deploy, depois que o rollback da imagem deixou de ser necessário. Assim a imagem anterior
continua compatível com o banco atual e o rollback de imagem não exige rollback de banco.

## 1. Rollback de imagem

1. Descubra a última tag boa: `v1.2.2` em produção, `sha-abc1234` em staging (aba Actions, workflow
   Deploy, ou o registro `ghcr.io/<org>/gymos-api`).
2. Rode o workflow de deploy dessa tag de novo (Actions → Deploy → "Re-run jobs" na execução dela) ou,
   direto no provedor, `DEPLOY_PROVEDOR=<provedor> tools/deploy/deploy.sh production v1.2.2`.
3. Confirme `GET /health/ready` na API e o `release` no Sentry (a tag é o `SENTRY_RELEASE`).
4. Se a migração da versão com problema era só de expansão, pare aqui.

## 2. Rollback de migração

O Prisma não tem migração "down". Cada migração que precisa ser reversível guarda um `down.sql` ao
lado do `migration.sql` (o `migrate deploy` ignora o arquivo). O script reverte **só a última migração
aplicada**, numa transação, e remove o registro de `_prisma_migrations`: a migração volta a ficar
pendente.

```bash
DATABASE_MIGRATOR_URL=postgresql://gymos_migrator:...@host:5432/gymos \
  node tools/architecture/ci/rollback-migracao.ts 20261201000000_nome_da_migracao
```

Antes de rodar:

1. Reverta a imagem **primeiro** (passo 1), para o código antigo não usar o que vai sumir.
2. Faça backup ou snapshot do banco (o `down.sql` de uma migração que apagou dados não os traz de volta).
3. Reverta uma migração por vez, da mais nova para a mais antiga.

Sem `down.sql` o script recusa. Nesse caso escreva a reversão à mão, rode-a com o papel
`gymos_migrator` e apague a linha em `_prisma_migrations`, tudo numa transação.

Para escrever o `down.sql`: desfaça exatamente o que o `migration.sql` fez, na ordem inversa
(`DROP TABLE`, `DROP COLUMN`, `DROP POLICY`...). Toda migração nova que cria tabela, coluna ou
política deve trazer o seu. As migrações anteriores ao T03 não têm `down.sql`.

## Ensaio no CI

O spec `tools/architecture/src/rollback-migracao.spec.ts` (job `portoes` do PR) cria um banco, aplica
as migrações do repositório mais uma migração de exemplo, a reverte pelo script e aplica de novo.
O rollback de imagem e de migração em staging real (com o log anexado ao PR) fica para quando o
provedor for escolhido.
