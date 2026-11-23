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
| `forms`      | máscaras e diretivas de formulário                        | T09    | `type:util`   |
| `testing`    | harness de teclado para testes                            | T10    | `type:util`   |
| `ambiente`   | banner DEV/STAGING (não depende de `libs/ui`)             | T02    | `type:util`   |
| `events`     | tipos dos eventos de domínio                              | T13a   | `type:util`   |
| `acesso`     | regras de acesso usadas pela API e pelo agente da catraca | T23a   | `type:domain` |

O tipo da tabela é o esperado; o ticket confirma ao criar o pacote, e o dono do pacote está no
`CODEOWNERS`.

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
- `application/` não importa de `infra/` nem `interface/`.

Integrações externas (emissor fiscal, pagamentos, catraca, Meta, IA, armazenamento) ficam atrás de
portas com adapter fake determinístico (ADRs 008 a 012).

### Configuração

A API valida as variáveis de ambiente com Zod em `apps/api/src/config/env.ts`. `main.ts` chama
`loadEnv(process.env)` antes de criar a aplicação; se faltar ou estiver inválida alguma variável, registra
a lista e encerra com código 1. Toda variável nova entra no schema e no `.env.example` no mesmo PR.

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
