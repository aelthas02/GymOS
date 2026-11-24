# Arquitetura

Visão das camadas do GymOS e das regras de import. As decisões e o porquê de cada escolha estão nos
[ADRs](docs/adr/README.md); as regras de tela e de fatia vertical estão resumidas no fim deste arquivo.

## Monorepo

Workspace Nx integrado com pnpm (ADR-001). Cada projeto tem um `project.json` com duas tags: o
**escopo** (de quem é o código) e o **tipo** (em que camada ele está). Os aliases de import ficam em
`tsconfig.base.json` (`@gymos/ui`, `@gymos/api-contracts` e um `@gymos/shared-<pacote>` por pacote
compartilhado).

| Projeto           | Caminho                | Escopo          | Tipo               |
| ----------------- | ---------------------- | --------------- | ------------------ |
| `staff-web`       | `apps/staff-web`       | `scope:staff`   | `type:app`         |
| `student-app`     | `apps/student-app`     | `scope:student` | `type:app`         |
| `api`             | `apps/api`             | `scope:api`     | `type:app`         |
| `turnstile-agent` | `apps/turnstile-agent` | `scope:agent`   | `type:app`         |
| `ui`              | `libs/ui`              | `scope:shared`  | `type:ui`          |
| `api-contracts`   | `libs/api-contracts`   | `scope:shared`  | `type:data-access` |
| `architecture`    | `tools/architecture`   | `scope:shared`  | `type:util`        |

## Regras de import entre projetos

Aplicadas pelo `@nx/enforce-module-boundaries` no `eslint.config.mjs` da raiz. `pnpm lint` falha se uma
regra for violada.

**Escopo**: cada escopo importa só de si mesmo e de `scope:shared`.

| Quem importa    | Pode importar                   |
| --------------- | ------------------------------- |
| `scope:staff`   | `scope:staff`, `scope:shared`   |
| `scope:student` | `scope:student`, `scope:shared` |
| `scope:api`     | `scope:api`, `scope:shared`     |
| `scope:agent`   | `scope:agent`, `scope:shared`   |
| `scope:shared`  | `scope:shared`                  |

**Tipo (camada)**: as dependências descem, nunca sobem.

| Quem importa       | Pode importar                                    |
| ------------------ | ------------------------------------------------ |
| `type:app`         | `feature`, `ui`, `data-access`, `domain`, `util` |
| `type:feature`     | `feature`, `ui`, `data-access`, `domain`, `util` |
| `type:ui`          | `ui`, `util`                                     |
| `type:data-access` | `data-access`, `domain`, `util`                  |
| `type:domain`      | `domain`, `util`                                 |
| `type:util`        | `util`                                           |

Consequências diretas:

- `libs/ui` não importa de `apps/*` (o Nx proíbe importar um app, por alias ou por caminho relativo)
  nem de libs `data-access`, como `libs/api-contracts`. Componentes de apresentação recebem dados por
  `input()` e emitem `output()`.
- Uma lib `domain` não importa `data-access`, que é a camada de infraestrutura do lado das libs.
- Nenhum projeto importa outro por caminho relativo; só pelo alias `@gymos/*`.

Ao criar um projeto, dê as duas tags no gerador (`--tags="scope:<escopo>,type:<tipo>"`). Os testes em
`tools/architecture` provam as regras com fixtures de lint e rodam em todo PR.

## Pacotes compartilhados (`libs/shared/<pacote>`)

`libs/shared/` é só uma pasta de agrupamento, sem projeto na raiz. Cada pacote compartilhado é um
projeto Nx próprio, criado pelo ticket que precisa dele:

- caminho `libs/shared/<pacote>`, um nível abaixo de `libs/shared/`;
- nome do projeto `shared-<pacote>` e alias `@gymos/shared-<pacote>`;
- tags `scope:shared` e exatamente um tipo: `type:util` (utilitários, formatação, componentes simples)
  ou `type:domain` (regras de negócio puras, sem framework).

```sh
pnpm nx g @nx/js:library libs/shared/<pacote> --name=shared-<pacote> \
  --importPath=@gymos/shared-<pacote> --bundler=none --unitTestRunner=vitest \
  --tags="scope:shared,type:util"
```

Pacotes com Angular (diretivas, componentes) usam `@nx/angular:library` com os mesmos nome, alias e
tags. O teste `tools/architecture/src/shared-packages.spec.ts` confere a convenção.

| Pacote       | Conteúdo                                                  | Ticket | Tipo          |
| ------------ | --------------------------------------------------------- | ------ | ------------- |
| `money`      | tipo Centavos, arredondamento, rateio                     | T08    | `type:util`   |
| `validation` | validadores (CPF, CNPJ, telefone, e-mail, datas)          | T08    | `type:util`   |
| `pipes`      | pipes de exibição (`brl`, `cpf`, `dateBr`…)               | T08    | `type:util`   |
| `templates`  | variáveis de mensagem                                     | T08    | `type:util`   |
| `forms`      | `ValidatorFn` e mensagens (T08); máscaras e diretivas     | T09    | `type:util`   |
| `testing`    | harness de teclado para testes                            | T10    | `type:util`   |
| `ambiente`   | banner DEV/STAGING, correlationId e Sentry do front       | T02    | `type:util`   |
| `events`     | tipos dos eventos de domínio                              | T13a   | `type:util`   |
| `acesso`     | regras de acesso usadas pela API e pelo agente da catraca | T23a   | `type:domain` |

O tipo da tabela é o esperado; o ticket confirma ao criar o pacote, e o dono do pacote está no
`CODEOWNERS`.

`money`, `validation`, `templates` e os formatadores de `pipes` também rodam no back, por isso o lint
proíbe `@angular/*` neles. O back importa os formatadores (`formatarBrl`, `formatarDataBr`…) pelo
alias `@gymos/shared-pipes/formatadores`, que não carrega os pipes Angular. Esses pacotes exigem 100%
de cobertura de linhas e branches no `vitest` de cada um.

Nos arquivos de `domain/`, o lint proíbe `* 0.`, `/ 100` e `/ 10000`: dinheiro é centavo inteiro e
alíquota é ponto-base inteiro, com as funções de `money` (`aplicarAliquota`, `ratear`, `ratearPorPeso`).

## Front-end (Angular)

Angular zoneless, standalone, signals e OnPush (ADR-002).

```
apps/<app>/src/app/
  app.ts, app.config.ts, app.routes.ts   raiz: só a saída do roteador e os providers
  features/<feature>/
    pages/        containers: injetam a store e compõem a tela
    components/   apresentação: só input() e output()
    data-access/  store da feature (NgRx SignalStore) e chamadas ao cliente gerado
    models/       tipos da feature (os da API vêm de @gymos/api-contracts)
    utils/        funções puras da feature
    testing/      fixtures da regressão visual (<Tela>.fixture.ts)
```

- Rota lazy por feature; cada módulo extra é um chunk próprio guardado por `featureFlagGuard`.
- Sem regra de negócio no componente: totais, prazos e situações vêm calculados da API.
- Derivados com `computed`, sem função chamada no template, `track` em todo `@for`.
- Cliente HTTP gerado de `libs/api-contracts`; nenhum tipo de API escrito à mão (ADR-005).
- O lint proíbe componente fora de OnPush (`prefer-on-push-component-change-detection`).
- Cor só por token de `libs/ui/styles` (`var(--nome)` ou `cssVar()`); a regra
  `gymos/no-hardcoded-color` recusa cor fixa no front. O acento da academia passa pelo
  `ThemeService` (ADR-014). Detalhes no [README da `libs/ui`](libs/ui/README.md).

## Back-end (NestJS, hexagonal)

Módulos por domínio em `apps/api/src/modules/<dominio>/` (ADR-003):

```
domain/        entidades, regras e portas; TypeScript puro
application/   casos de uso; dependem das portas do domínio
infra/         Prisma, filas, adapters das integrações externas
interface/     controllers e DTOs
```

As dependências apontam para dentro: `interface` e `infra` → `application` → `domain`. O
`apps/api/eslint.config.mjs` aplica isso:

- `domain/` não importa de `application/`, `infra/` nem `interface/`, nem `@nestjs/*`, `@prisma/*` ou
  `prisma`;
- `application/` não importa de `infra/` nem `interface/`;
- `domain/` e `application/` não leem o relógio do sistema (`Date.now()`, `new Date()` sem argumento):
  usam a porta `Relogio`; consultas SQL dos módulos não usam `now()` nem `CURRENT_*`;
- fora de `modules/platform`, nenhum módulo importa o cliente Prisma global (`PrismaService`).

### Plataforma e multi-tenancy

`modules/platform` concentra o que é transversal (ADR-003 e ADR-004):

```
requisição → contexto (AsyncLocalStorage) → tenant pelo Host (404 se desconhecido)
           → transação com set_config('app.tenant_id', id, true) → handler → commit
```

- Repositórios recebem `ContextoDoTenant` e usam `contexto.cliente()`, o cliente da transação.
- Workers, jobs e webhooks usam `ExecutorDeTenant.runAsTenant(tenantId, fn)` ou `paraCadaTenant(fn)`.
- Toda tabela de domínio nasce por `pnpm nx g @gymos/api:tabela <dominio> <nome>`: `tenant_id`, índice,
  RLS forçado, política por `app.tenant_id` e o teste de convenção.
- Tempo pela porta `Relogio` (`agora()`, `hojeEm(fuso)`); em teste, `RelogioFixo`.
- Endpoints com `@nestjs/swagger`; `pnpm nx run api:openapi` regenera `libs/api-contracts` (ADR-005).

Integrações externas (emissor fiscal, pagamentos, catraca, Meta, IA, armazenamento) ficam atrás de
portas com adapter fake determinístico (ADRs 008 a 012).

### Eventos, filas, cache e tempo real

O `EventosModule` (`modules/platform/eventos.module.ts`, ADR-007, T13a) é global. As portas ficam em
`modules/platform/application/eventos.ts`; os tipos dos eventos, em `@gymos/shared-events`.

```
caso de uso ─ publicar() ─▶ evento_outbox (mesma transação)
despachante ─ FOR UPDATE SKIP LOCKED ─▶ 1 job por consumidor (BullMQ, fila do consumidor)
worker ─ runAsTenant ─▶ marca evento_processado + efeito do consumidor (mesma transação) ─▶ ack
```

**Publicar um evento.** No caso de uso, injete `PublicadorDeEventos` e chame
`publicar({ tipo: 'PagamentoConfirmado', payload })` dentro da requisição ou de `runAsTenant`. O
tenant, o id e o instante vêm da plataforma. Se o caso de uso falha, o rollback leva o evento junto.

**Consumir um evento.** No `onModuleInit` do módulo do domínio, registre o consumidor:

```ts
registro.registrar({
  nome: 'fiscal.emitir-nota', // estável: com o id do evento, é a chave de idempotência
  evento: 'PagamentoConfirmado',
  fila: 'notas',
  tratar: async (evento) => {
    /* efeito pelo contexto.cliente(), na transação da entrega */
  },
});
```

- A entrega é pelo menos uma vez e o efeito no banco, exatamente uma: a marca em `evento_processado`
  e o efeito estão na mesma transação. Efeito fora do banco (e-mail, emissor) precisa de chave de
  idempotência própria no provedor, ou de um job seguinte.
- Erro faz nova tentativa com espera exponencial; na quinta falha o job vai para a fila `falhas` com
  o motivo. Reprocessar: `POST /api/interno/falhas/:id/reprocessar` com a chave de operação.
- Consumidor registrado depois de o evento ser despachado não o recebe.

**Filas e jobs.** `Filas.enfileirar(fila, nome, { tenantId, ... })` nas filas `eventos`, `cobranca`,
`notas`, `mensagens`, `importacao` e `notificacoes`; job sem `tenantId` é recusado. O trabalho é
registrado com `ProcessadorDeFilas.registrarTrabalho(fila, nome, fn)` e roda em `runAsTenant`. Com
`FILAS_PROCESSAR=true`, o processo sobe os workers e o despachante; em dev e staging, o painel fica em
`/interno/filas` (chave de operação no cabeçalho `x-chave-de-operacao` ou como senha do navegador).

**Cache.** Só pelo `CacheComTenant`: `obter(['resumo-financeiro', mes], carregar, { ttlSegundos })` e
`invalidar(chave)`, sempre no tenant do contexto (`chaveDeCache(tenantId, ...partes)` monta
`tenant:<id>:cache:...`). Para invalidar por evento:
`cache.invalidarAoReceber('PagamentoConfirmado', 'financeiro.cache-resumo', (e) => [['resumo-financeiro']])`.

**Tempo real.** `TempoRealPorTenant.publicar(topico, mensagem)` e `assinar(topico, aoReceber)`, no canal
`tenant:<id>:<topico>` do tenant do contexto. Publique a partir de um consumidor de evento, depois do
commit, para não avisar o que um rollback desfez.

O lint proíbe `ioredis`, `bullmq` e `@bull-board/*` fora de `modules/platform`. Tudo no Redis fica sob
`REDIS_PREFIXO`; os testes de integração usam um prefixo por arquivo (`usarRedisDeTeste`).

### Autenticação, permissões e módulos extras

`modules/autenticacao` (T12, ADR-006):

- **Acesso declarado em toda rota `/api`**: `@Publica()`, `@Autenticado()` ou
  `@RequirePermission('alunos:excluir')`. O teste `acesso-declarado.spec.ts` recusa rota sem
  declaração. `@RequireModule('loja')` responde 404 com o módulo desligado.
- O `AcessoGuard` é global e roda antes do interceptor de transação: lê o banco na própria transação
  do tenant. A sessão validada chega ao handler por `@SessaoAtual()`.
- Catálogo de permissões e tipos padrão em `domain/permissoes.ts` e `domain/tipos-de-acesso.ts`;
  planos e módulos extras em `domain/modulos-do-plano.ts`.
- E-mail só pela porta `EnvioDeEmail` (`EMAIL_TRANSPORTE=fake` guarda em memória).

### Configuração

A API valida as variáveis de ambiente com Zod em `apps/api/src/config/env.ts`. `main.ts` chama
`loadEnv(process.env)` antes de criar a aplicação; se faltar ou estiver inválida alguma variável, registra
a lista e encerra com código 1. Toda variável nova entra no schema e no `.env.example` no mesmo PR.
As variáveis já validadas chegam aos providers pelo token `ENV` (`config/env.module.ts`).

### Observabilidade

Em `apps/api/src/observabilidade/` (T02):

- **Logs**: JSON pelo pino (`nestjs-pino`); use o `Logger` do `@nestjs/common`. Todo log feito
  durante uma requisição leva o `correlationId`, que vem do cabeçalho `x-correlation-id` (o front o
  envia em cada requisição) ou é gerado, e volta no cabeçalho da resposta.
- **Saúde**: `/health/live` (processo de pé) e `/health/ready` (Postgres e Redis; 503 se algum
  falha), fora do prefixo `/api`.
- **Métricas**: `/metrics` no formato do Prometheus, fora do prefixo `/api` e só na rede interna;
  latência e erros 5xx por rota do Nest. Cada fila registra a contagem de jobs no `QueueMetrics`.
- **Sentry**: `instrument.ts` inicia antes do Nest; erros que não são `HttpException` vão com a tag
  `correlationId`, o `APP_ENV` como ambiente e o `SENTRY_RELEASE`. Sem `SENTRY_DSN`, desligado. Os
  eventos não levam dados pessoais.

No front, `@gymos/shared-ambiente` dá o banner DEV/STAGING, o interceptor do `x-correlation-id` e o
Sentry dos dois apps. Cada app tem `environment.dev.ts`, `environment.staging.ts` e
`environment.prod.ts`, trocados por `fileReplacements` nas configurações de build de mesmo nome.

## Agente da catraca

`apps/turnstile-agent` é um app Node próprio (ADR-016). No T01 existe só com build e teste; o núcleo
chega no T24a.

## Regras comuns de tela e de fatia vertical

O detalhe está no ticket "Regras comuns a toda tela e fatia vertical"; o essencial:

- Tela fiel ao HTML e ao PNG de `docs/design/telas/`; regressão visual só no front, com a API
  interceptada por fixture e baseline no HTML de referência (ADR-019).
- Toda tela tem os estados carregando, vazio, erro com "Tentar agora" e sem permissão.
- Tempo sempre pela porta `Relogio`; dinheiro em centavos e percentuais em pontos-base com
  `libs/shared/money`; dias de atraso sempre de `diasDeAtraso` (ADR-018).
- Cache e tempo real só por tenant; eventos tipados em `libs/shared/events` com consumidores
  idempotentes pelo outbox (ADR-007).
- Todo caso de uso que altera dado chama a auditoria; campos sensíveis usam a cifra e o índice cego
  (ADR-015); todo domínio com dado de aluno implementa exportação e exclusão do titular (LGPD).
- Listas grandes paginam por cursor no servidor; endpoints documentados no OpenAPI e regenerados em
  `libs/api-contracts` no mesmo PR.
