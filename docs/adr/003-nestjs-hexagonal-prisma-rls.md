# ADR-003: NestJS hexagonal, Prisma e RLS com `SET LOCAL app.tenant_id`

- Status: Aceito
- Data: 2026-11-21 (padrão final em 2026-11-23)
- Ticket: T01 (registro); implementação no T11

## Contexto

O GymOS é multi-tenant com `tenant_id` em todas as tabelas e Row-Level Security no Postgres (prompt,
item 3). A API usa pool de conexões, e uma variável de sessão esquecida numa conexão reaproveitada
vazaria dados de outra academia. O prompt também pede módulos por domínio em arquitetura hexagonal,
com integrações atrás de portas.

## Decisão

- **NestJS 11.2** em `apps/api`. O Nest 12 (12.6.0 no npm) é só ESM (`"type": "module"`), e o
  `@nx/nest` 24.0.6 gera e compila Nest `^11` em CommonJS com webpack. Reavaliar quando o Nx suportar o
  Nest 12.
- **Hexagonal por domínio**: `src/modules/<dominio>/{domain,application,infra,interface}`. O domínio é
  TypeScript puro (sem Nest nem Prisma); `application` depende de portas do domínio; `infra` e
  `interface` dependem para dentro. O lint de `apps/api` aplica essas regras. O que é transversal fica
  em `src/modules/platform` (tenant, contexto, transação, `runAsTenant`, `Relogio`, webhooks, contrato).
- **Prisma 7.10.1**, a última estável (a tag `latest` do npm aponta para a 8.0.0-rc). Gerador
  `prisma-client` em CommonJS (`src/generated/prisma`, fora do Git, gerado pelo alvo
  `api:prisma-generate`), adapter `@prisma/adapter-pg` e schema em pasta: `prisma/schema/<dominio>.prisma`.
  O Prisma 7 avisa no `pnpm install` que não reconhece o Node 26; funciona e os testes passam.

### Papéis do Postgres

| Papel            | Uso                                                | Privilégios                                      |
| ---------------- | -------------------------------------------------- | ------------------------------------------------ |
| `gymos_migrator` | dono das tabelas; aplica as migrações (`migrar`)   | `USAGE, CREATE` no schema; sem `BYPASSRLS`       |
| `gymos_app`      | API e workers (`DATABASE_URL`)                     | DML por tabela e `EXECUTE` nas funções `gymos_*` |
| administrador    | `pnpm gymos preparar-banco` e testes de integração | `CREATEDB` e `CREATEROLE` (fora da aplicação)    |

Nenhum dos dois papéis da aplicação é superusuário nem tem `BYPASSRLS`; `preparar-banco` recusa um
papel existente que tenha.

### Convenção de tabela

Toda tabela de domínio nasce pelo gerador `pnpm nx g @gymos/api:tabela <dominio> <nome>`, que cria o
modelo, a migração e o teste de convenção. A migração tem:

```sql
"tenant_id" UUID NOT NULL                       -- e um índice que começa por tenant_id
ALTER TABLE t ENABLE ROW LEVEL SECURITY;
ALTER TABLE t FORCE ROW LEVEL SECURITY;         -- vale também para o dono (gymos_migrator)
CREATE POLICY t_isolamento_por_tenant ON t
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON t TO gymos_app;
```

Sem a variável, ou com ela vazia (o que sobra numa conexão do pool depois de um `SET LOCAL` anterior),
a política devolve zero linhas, sem erro. O teste `convencao-rls.int.spec.ts` verifica todas as tabelas
do banco migrado; política permissiva extra para `public` ou `gymos_app` também reprova. O teste
`deriva.int.spec.ts` compara o banco migrado com o schema Prisma (`prisma migrate diff`), então o SQL
escrito à mão ou pelo gerador não pode divergir do modelo.

Fora da convenção ficam `tenant`, lida antes de existir contexto, e `_prisma_migrations`. O `gymos_app`
não tem acesso direto a `tenant`: lê e escreve pelas funções `SECURITY DEFINER` `gymos_tenant_por_slug`,
`gymos_tenant_por_id`, `gymos_listar_tenants`, `gymos_criar_tenant`,
`gymos_atualizar_identidade_do_tenant` (só o tenant do contexto) e `gymos_tenant_da_referencia_externa`.

Migrações de dados também passam pela política (o dono é forçado): uma correção em massa itera os
tenants e faz `set_config('app.tenant_id', id, true)` antes de cada `UPDATE`.

### Contexto por requisição

1. O middleware abre o contexto (AsyncLocalStorage) e resolve o tenant pelo Host (ADR-004); tenant
   desconhecido responde 404 sem abrir transação.
2. O interceptor global abre uma transação Prisma e executa
   `SELECT set_config('app.tenant_id', $1, true)`, equivalente a `SET LOCAL`. Erro desfaz a transação
   e a resposta só sai depois do commit.
3. Repositórios usam `ContextoDoTenant.cliente()`, o cliente da transação. O cliente global
   (`PrismaService`) é só da plataforma; o lint proíbe importá-lo em outro módulo.

### `runAsTenant`

Workers, jobs e webhooks usam `ExecutorDeTenant.runAsTenant(tenantId, fn)`: sem `tenantId` lança
`TenantObrigatorioError` sem executar `fn`; tenant inexistente lança `TenantDesconhecidoError`; com
tenant, abre a mesma transação do item 2. Jobs para todos os tenants usam `paraCadaTenant(fn)`, que
itera `gymos_listar_tenants()` e chama `runAsTenant` por tenant (a falha de um não para os outros).

Webhooks chegam em `/webhooks/:provedor/:tenantSlug` ou, quando o provedor não manda o tenant, em
`/webhooks/:provedor`, que acha o dono pela tabela `referencia_externa (provedor, id_externo)`. O
handler sempre roda em `runAsTenant`: um id externo de outro tenant não é encontrado e a resposta é 404.

### Tempo

A porta `Relogio` (`agora()` em UTC, `hojeEm('America/Sao_Paulo')`) tem `RelogioFixo` para testes, e
o cabeçalho `x-relogio` fixa o instante da requisição fora de produção. O lint proíbe `Date.now()`,
`Date()` e `new Date()` sem argumento em `domain/` e `application/`, e `now()`/`CURRENT_*` em SQL nos
módulos.

### Testes

Os testes de integração rodam contra um Postgres de verdade, sem Testcontainers: o `globalSetup` cria
um banco-modelo com as migrações a partir de `TEST_DATABASE_ADMIN_URL`, cada arquivo de teste clona o
seu e tudo é apagado no fim. No CI, o Postgres vem de `services:` do GitHub Actions (README, "Testes de
integração").

## Alternativas consideradas

- **TypeORM**: também citado no prompt; o Prisma tem tipos gerados mais seguros e migrações mais
  simples.
- **`SET` de sessão em vez de `SET LOCAL`**: inseguro com pool, porque a variável sobrevive à
  requisição.
- **Schema ou banco por tenant**: isolamento forte, mas migrações e custo crescem com o número de
  academias.
- **Nest 12**: exigiria build ESM próprio fora do plugin do Nx.
- **Prisma 8 (RC)**: não usamos release candidate.
- **Extensão do Prisma Client que injeta o tenant em cada consulta**: o isolamento ficaria no código,
  não no banco; consulta crua escaparia.
- **Transação aberta num middleware**: a resposta sairia antes do commit e um erro não desfaria a
  escrita; o interceptor resolve os dois.

## Consequências

- Toda consulta passa por uma transação por requisição; jobs e webhooks usam `runAsTenant`.
- Guards que precisem do banco (T12) usam `runAsTenant` ou rodam depois do interceptor.
- Chave estrangeira para `tenant` só nas tabelas da plataforma: o gerador não a cria para não editar o
  modelo `Tenant` a cada domínio; o `WITH CHECK` já prende o `tenant_id` a um tenant resolvido.
- O domínio fica testável sem banco e sem Nest.
- A migração para o Nest 12 será um ticket próprio quando o Nx suportar.
