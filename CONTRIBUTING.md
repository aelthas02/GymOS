# Como contribuir

## TDD: vermelho → verde → refatorar

Todo código novo começa pelo teste.

1. **Vermelho**: escreva os testes listados em "Testes primeiro" no ticket e veja-os falhar pelo motivo
   certo (a regra ainda não existe, não um erro de digitação no teste).
2. **Verde**: escreva o mínimo de código para os testes passarem.
3. **Refatorar**: limpe nomes, duplicações e estrutura com os testes verdes.

O PR mostra os testes falhando no primeiro commit e a implementação nos seguintes. Relógio e rede são
sempre controlados (porta `Relogio`, adapters fake); nenhum teste depende da ordem de outro. Testes de
regra de negócio usam dados próprios do teste, não os nomes do protótipo, quando a tela contradiz a
regra.

Cobertura: o relatório sai em `coverage/` a cada `pnpm test`. Os limites mínimos (85% de linhas e 80%
de branches no geral; 100% em validadores, máscaras, pipes, dinheiro e domínio) entram no CI pelo T03.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/), verificados pelo commitlint no hook
`commit-msg`. Assunto em português, no imperativo e em minúsculas:

```
feat(api): valida variáveis de ambiente na inicialização
fix(staff-web): corrige o foco do modal ao fechar
test(ui): cobre a navegação por teclado das abas
docs(adr): registra a decisão do provedor de pagamento
```

Tipos: `feat`, `fix`, `test`, `refactor`, `perf`, `docs`, `style`, `build`, `ci`, `chore`, `revert`. O
escopo é opcional e costuma ser o projeto Nx. Linhas do corpo com até 100 caracteres.

O hook `pre-commit` roda ESLint e Prettier nos arquivos do commit (lint-staged). Não use `--no-verify`:
se o hook falhar, corrija a causa.

## Pull requests

- **Pequenos**: uma tela ou um caso de uso por PR quando possível.
- Antes de abrir, rode `pnpm lint`, `pnpm test` e `pnpm build`. O CI roda os mesmos alvos com
  `nx affected`, mais a verificação do Prettier.
- Mudança em pasta de outro agente exige a revisão do dono ([`CODEOWNERS`](CODEOWNERS)).
- Endpoint novo regenera `libs/api-contracts` no mesmo PR; variável de ambiente nova entra no schema
  da API e no `.env.example`.
- Divergência entre telas vai para [`docs/design/inconsistencias.md`](docs/design/inconsistencias.md)
  com a decisão tomada. Os demais arquivos de `docs/design/` não são alterados.
- Decisão de arquitetura nova vira um ADR em [`docs/adr/`](docs/adr/README.md).

## Projetos novos

Gere pelo Nx e dê as tags de escopo e de tipo (ver [`ARCHITECTURE.md`](ARCHITECTURE.md)):

```sh
pnpm nx g @nx/angular:library libs/<nome> --tags="scope:shared,type:ui"
pnpm nx g @nx/js:library libs/<nome> --bundler=none --unitTestRunner=vitest --tags="scope:shared,type:util"
```

Acrescente o alvo `typecheck` no `project.json`, como nos projetos existentes, e a linha do dono no
`CODEOWNERS`.
