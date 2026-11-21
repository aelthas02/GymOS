# ADR-013: Vitest, Angular Testing Library e Playwright

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (Vitest e cobertura); T03 (limites); T35 (E2E e regressão visual)

## Contexto

O prompt pede TDD, Jest ou Vitest com Angular Testing Library, E2E com Playwright e regressão visual
contra as telas de referência (Playwright ou Storybook + Chromatic).

## Decisão

- **Vitest** no front e no back, com cobertura v8 (relatórios `text-summary` e `lcov` em `coverage/`).
  Os limites mínimos entram no T03.
  - Apps Angular: builder oficial `@angular/build:unit-test` (Vitest com jsdom).
  - Libs Angular (`libs/ui`): o builder oficial exige lib com build; usamos `@analogjs/vitest-angular`
    pelo plugin `@nx/vitest`, o padrão do Nx para libs sem build.
  - API, agente da catraca e libs TypeScript: `@nx/vitest`.
- **Angular Testing Library** nos testes de componente e página.
- **Playwright** para E2E e para a regressão visual por screenshot; **Storybook** só como
  documentação dos componentes. A regressão visual segue o ADR-019.
- Testes de fronteira de arquitetura em `tools/architecture` (lint de fixtures).

## Alternativas consideradas

- **Jest**: mais lento e com suporte a ESM mais frágil; o Angular adotou o Vitest como padrão.
- **Chromatic**: custo recorrente e comparação contra outro ambiente.
- **Karma**: descontinuado no ecossistema Angular.

## Consequências

- Dois caminhos de Vitest no Angular (builder oficial nos apps, Analog nas libs) até o builder oficial
  aceitar libs sem build.
- Relógio e rede controlados em todo teste (porta `Relogio`, `page.clock`, adapters fake).
