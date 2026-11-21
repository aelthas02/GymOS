# ADR-001: Nx como monorepo, com pnpm e Node 26

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01

## Contexto

O prompt (item 3) pede um monorepo com `apps/staff-web`, `apps/student-app`, `apps/api`, `libs/ui`,
`libs/shared` e `libs/api-contracts`, e deixa a escolha entre Nx e pnpm workspaces + Turborepo. O item 6
exige regras de import por camada com `enforce-module-boundaries`, e o CI precisa rodar só o que a
mudança afeta.

## Decisão

- **Nx 24.0.6** em modo integrado: cada projeto tem `project.json`, os aliases `@gymos/*` ficam em
  `tsconfig.base.json` e há um único `package.json` na raiz.
- **pnpm 12.21.0**, fixado em `packageManager`. O pnpm 12 bloqueia scripts de instalação das
  dependências por padrão; a lista do que pode rodar fica em `allowBuilds` no `pnpm-workspace.yaml`
  (hoje só o `nx`).
- **Node 26** (`.nvmrc` = `26`, `engines.node` = `>=26.0.0`). Verificado com o Node 26.8.1: o Angular CLI
  22.2 declara suporte a `^22.22.3 || ^24.15.0 || >=26.0.0`, o Nx a `>=20`, e lint, testes, build e
  `pnpm dev` rodaram sem ajuste. O Node 26 é a linha LTS ativa desde outubro de 2026.
- Tags de projeto e camadas descritas no `ARCHITECTURE.md`; o lint aplica as restrições.

## Alternativas consideradas

- **pnpm workspaces + Turborepo**: cache e execução paralela equivalentes, mas sem regra nativa de
  fronteira entre projetos (teria de vir de `eslint-plugin-boundaries`) e sem geradores para Angular
  e Nest.
- **Nx no modo "TS solution"** (workspaces do pnpm + project references): o plugin do Angular não
  suporta esse modo; misturar os dois estilos complicaria os caminhos de import.
- **npm ou Yarn**: o pnpm instala mais rápido, usa menos disco e é mais estrito com dependências não
  declaradas.

## Consequências

- `nx affected` no CI e cache local de lint, teste, typecheck e build.
- As versões de Nest, Vitest e Analog seguem o que o Nx 24 suporta; atualizações passam por
  `nx migrate`.
- Todo comando de projeto roda pelo Nx (`pnpm nx <alvo> <projeto>`); os scripts da raiz são atalhos.
- Quem trocar de máquina precisa do Node 26 e do pnpm 12 (o README explica como instalar).
