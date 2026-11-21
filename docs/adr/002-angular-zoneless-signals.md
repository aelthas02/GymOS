# ADR-002: Angular zoneless, standalone, signals e NgRx SignalStore

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01

## Contexto

O prompt pede Angular na versão estável mais recente, componentes standalone, signals, control flow
nativo, `OnPush` em tudo e lazy loading por módulo. As stores por feature precisam de algo leve que
sirva de facade.

## Decisão

- **Versão exata: Angular 22.2.7** (`@angular/core` e demais pacotes do framework) com **CLI e
  `@angular/build` 22.2.8**, builder `application` (esbuild).
- **Por que não a 22.3.0**, que é a estável mais recente no npm (publicada em 18/11/2026): o
  `@angular-devkit/architect` 0.2203.0, que acompanha a 22.3, passou a declarar `exports` sem o
  subcaminho `./node/index.js`. O Nx 24.0.6 (e também o 24.1.0-beta.2) importa
  `@angular-devkit/architect/node/index.js` no adaptador dos builders, e todo alvo Angular rodado pelo
  Nx falha com `Package subpath './node/index' is not defined by "exports"`. Ficamos na 22.2 com
  `~22.2.x` e um `overrides` no `pnpm-workspace.yaml` que alinha o architect em 0.2202.8 (o
  angular-eslint e o Analog aceitam faixas que resolviam para a 0.2203). Quando o Nx publicar a
  correção, remover o override e migrar com `nx migrate`.
- **Zoneless** (padrão desde o Angular 21; o projeto não instala `zone.js`).
- **Standalone** e **signals**; control flow `@if`/`@for` com `track`.
- **OnPush**: no Angular 22 é a estratégia padrão de detecção de mudanças. O lint
  (`@angular-eslint/prefer-on-push-component-change-detection`) proíbe optar por `Eager`, e o gerador
  de componentes do Nx está configurado com `OnPush`.
- **NgRx SignalStore** para as stores por feature, instalado quando a primeira feature precisar (T14 em
  diante).

## Alternativas consideradas

- **Angular 22.3.0 com o architect forçado em 0.2202**: misturaria o CLI 22.3 com um architect de
  outra versão, combinação que nenhum dos dois projetos testa.
- **Nx 24.1 beta**: além de instável, tem o mesmo import.
- **zone.js**: mais detecção de mudança do que o necessário e incompatível com a meta de desempenho.
- **NgRx Store clássico**: actions, reducers e effects pesam mais do que as facades exigem.

## Consequências

- A versão do Angular fica uma minor atrás da mais recente até o Nx acompanhar; o README e este ADR
  registram como sair do override.
- Componentes novos nascem OnPush e o lint barra quem tentar desligar.
