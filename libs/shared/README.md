# libs/shared

Pasta de agrupamento, não é um projeto. Cada pacote compartilhado é um projeto Nx próprio em
`libs/shared/<pacote>`, criado pelo ticket que o usa:

- nome do projeto `shared-<pacote>` e alias `@gymos/shared-<pacote>`;
- tags `scope:shared` e `type:util` (utilitários, componentes simples) ou `type:domain` (regras de
  negócio puras).

A lista de pacotes previstos, os donos e o comando do gerador estão no `ARCHITECTURE.md`, seção
"Pacotes compartilhados". Os testes em `tools/architecture` conferem a convenção.
