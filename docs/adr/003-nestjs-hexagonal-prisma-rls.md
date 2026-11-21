# ADR-003: NestJS hexagonal, Prisma e RLS com `SET LOCAL app.tenant_id`

- Status: Aceito
- Data: 2026-11-21
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
  `interface` dependem para dentro. O lint de `apps/api` aplica essas regras.
- **Prisma** como acesso a dados. A versão é fixada no T11 (hoje a tag `latest` do npm aponta para uma
  release candidate da 8; usar a estável).
- **RLS**: cada requisição abre uma transação e executa `SET LOCAL app.tenant_id`; a API conecta com um
  papel sem `BYPASSRLS` e as tabelas usam `FORCE ROW LEVEL SECURITY`. Um teste de integração prova que
  um tenant não lê o outro.

## Alternativas consideradas

- **TypeORM**: também citado no prompt; o Prisma tem tipos gerados mais seguros e migrações mais
  simples.
- **`SET` de sessão em vez de `SET LOCAL`**: inseguro com pool, porque a variável sobrevive à
  requisição.
- **Schema ou banco por tenant**: isolamento forte, mas migrações e custo crescem com o número de
  academias.
- **Nest 12**: exigiria build ESM próprio fora do plugin do Nx.

## Consequências

- Toda consulta passa por uma transação por requisição; jobs e webhooks usam `runAsTenant` (T11).
- O domínio fica testável sem banco e sem Nest.
- A migração para o Nest 12 será um ticket próprio quando o Nx suportar.
