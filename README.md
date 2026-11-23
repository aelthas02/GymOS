# GymOS

Sistema de gestão de academias vendido como SaaS multi-tenant: painel da equipe (`staff-web`), app do
aluno em PWA (`student-app`), API (`api`) e o agente local da catraca (`turnstile-agent`). A referência
visual está em [`docs/design/`](docs/design/INDEX.md) e as decisões de arquitetura em
[`docs/adr/`](docs/adr/README.md).

## Requisitos

- **Node 26** (versão em [`.nvmrc`](.nvmrc); com nvm: `nvm use`).
- **pnpm 12.21** (`npm i -g pnpm@12.21.0`; a versão exata está em `packageManager` no `package.json`).
- **Docker** com Compose v2 e virtualização habilitada (no Windows, WSL 2 e virtualização ligada na
  BIOS).

## Como rodar

```sh
pnpm i
pnpm dev
```

O `pnpm dev`:

1. cria o `.env` a partir do [`.env.example`](.env.example) se ele ainda não existir;
2. sobe o `docker-compose.yml` e espera os serviços ficarem saudáveis;
3. sobe a API e os dois frontends com recarga automática.

| Serviço                                      | Endereço                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| Painel da equipe (`staff-web`)               | http://localhost:4200                                                         |
| App do aluno (`student-app`)                 | http://localhost:4300                                                         |
| API                                          | http://localhost:3000/api (os frontends usam `/api` pelo proxy do dev server) |
| Mailpit (caixa de entrada de e-mails de dev) | http://localhost:8025                                                         |
| MinIO (console do armazenamento S3)          | http://localhost:9001 (usuário `gymos`, senha `gymos-dev-secret`)             |
| Postgres 16                                  | `localhost:5432` (usuário, senha e banco `gymos`)                             |
| Redis 7                                      | `localhost:6379`                                                              |

`pnpm dev:down` para os contêineres (os volumes ficam). A API valida as variáveis de ambiente na
inicialização e não sobe se faltar alguma; a mensagem lista cada variável com problema.

Na primeira vez, prepare o banco e crie uma academia (ADR-003 e ADR-004):

```sh
pnpm gymos preparar-banco        # papéis gymos_migrator e gymos_app, banco e privilégios
pnpm nx run api:migrar           # migrações, como gymos_migrator
pnpm gymos criar-academia --slug ritmo --nome "Academia Ritmo" --admin-email adm@ritmo.test \
  --unidade "Unidade Centro"
```

Em dev, cada academia responde no seu subdomínio de `localhost` (`http://ritmo.localhost:3000/api`) ou
com o cabeçalho `x-tenant: ritmo`.

### Testes de integração

Os testes `*.int.spec.ts` da API rodam no `pnpm test` contra um Postgres de verdade, sem Docker
obrigatório: cada execução cria bancos descartáveis `gymos_test_*` com a conta de
`TEST_DATABASE_ADMIN_URL` (precisa de `CREATEDB` e `CREATEROLE`), aplica as migrações como
`gymos_migrator`, roda os testes como `gymos_app` e apaga os bancos no fim. Basta o Postgres do compose
(ou um local) e o `.env`. No CI, o Postgres vem de `services:` do GitHub Actions com as mesmas
variáveis:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env: { POSTGRES_USER: gymos, POSTGRES_PASSWORD: gymos, POSTGRES_DB: gymos }
    ports: ['5432:5432']
    options: --health-cmd "pg_isready -U gymos" --health-interval 5s --health-retries 20
env:
  TEST_DATABASE_ADMIN_URL: postgresql://gymos:gymos@localhost:5432/postgres
  DATABASE_URL: postgresql://gymos_app:gymos_app@localhost:5432/gymos
  DATABASE_MIGRATOR_URL: postgresql://gymos_migrator:gymos_migrator@localhost:5432/gymos
```

O bucket `gymos` do MinIO ainda não é criado automaticamente: quem implementar o armazenamento (T13d)
cria o bucket na inicialização em dev.

O MinIO do compose usa `pgsty/minio`, imagem comunitária (o `minio/minio` saiu do Docker Hub), apenas
em desenvolvimento; staging e prod usam o S3 gerenciado do provedor (ADR-017).

## Scripts

| Script                              | O que faz                                    |
| ----------------------------------- | -------------------------------------------- |
| `pnpm dev`                          | `.env`, compose, API e frontends             |
| `pnpm dev:down`                     | para os contêineres do compose               |
| `pnpm lint`                         | ESLint e typecheck em todos os projetos      |
| `pnpm test`                         | testes (Vitest) com cobertura em `coverage/` |
| `pnpm build`                        | build de produção de todos os apps           |
| `pnpm format` / `pnpm format:check` | Prettier nos arquivos alterados              |
| `pnpm gymos <comando>`              | operação: `preparar-banco`, `criar-academia` |
| `pnpm nx run api:migrar`            | aplica as migrações do Prisma                |
| `pnpm nx run api:openapi`           | regenera o contrato em `libs/api-contracts`  |
| `pnpm nx g @gymos/api:tabela d t`   | nova tabela de domínio com RLS               |

Para um projeto só: `pnpm nx <alvo> <projeto>` (por exemplo, `pnpm nx test api`). `pnpm nx graph`
mostra o grafo de dependências.

## Estrutura

```
apps/
  staff-web/        painel da equipe (Angular)
  student-app/      app do aluno (Angular, PWA)
  api/              API (NestJS)
  turnstile-agent/  agente local da catraca (Node)
libs/
  ui/               design system (Angular)
  shared/<pacote>/  pacotes compartilhados, um projeto por pacote (ver ARCHITECTURE.md)
  api-contracts/    contrato OpenAPI e cliente gerado
tools/
  architecture/     testes das regras de fronteira entre projetos
  scripts/          scripts de apoio do monorepo
docs/
  adr/              decisões de arquitetura
  design/           telas de referência (somente leitura) e registro de inconsistências
```

Leia também o [`ARCHITECTURE.md`](ARCHITECTURE.md) (camadas e regras de import) e o
[`CONTRIBUTING.md`](CONTRIBUTING.md) (TDD, commits e PRs).

## Revisão

O [`CODEOWNERS`](CODEOWNERS) atribui cada pasta ao agente dono, com times `@gymos/agente-*`. Os times
precisam existir na organização do GitHub (ou as linhas precisam apontar para usuários reais) para que
a revisão obrigatória funcione.
