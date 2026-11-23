# ADR-005: Contrato único com OpenAPI gerado pela API

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); implementação no T11

## Contexto

O prompt exige um contrato único: OpenAPI gerado pela API e cliente tipado para os dois frontends,
sem tipos duplicados à mão.

## Decisão

O `@nestjs/swagger` gera o OpenAPI no build para `libs/api-contracts/openapi.json`; o
`openapi-typescript` gera os tipos, e um cliente fino baseado em `HttpClient` fica em
`libs/api-contracts`. O CI falha se o arquivo gerado divergir do commitado. A lib tem as tags
`scope:shared` e `type:data-access`, então `libs/ui` não a importa.

## Alternativas consideradas

- **Tipos escritos à mão**: proibidos pelo prompt; divergem da API com o tempo.
- **tRPC ou GraphQL**: mudariam o modelo da API e o ferramental do Nest.
- **Contratos em Zod compartilhados (ts-rest)**: bons, mas o prompt pede OpenAPI como fonte.

## Consequências

- Todo endpoint novo regenera `libs/api-contracts` no mesmo PR: `pnpm nx run api:openapi` compila a API
  e escreve `openapi.json` (chaves ordenadas) e `src/generated/schema.ts`. O `api:openapi-check` falha
  se algum dos dois divergir; o CI o roda com `nx affected` (a API depende implicitamente de
  `api-contracts`, então mexer só no contrato também dispara a verificação).
- Os fronts usam `inject(CLIENTE_DA_API)` (`get`, `post`, `put`, `patch` e `delete` tipados por
  `paths`) e `Schemas['<Dto>']`; `URL_BASE_DA_API` fica vazia quando a API responde em `/api` no mesmo
  host.
- Webhooks e endpoints internos ficam fora do contrato (`@ApiExcludeController`).
- Os fixtures de regressão visual são tipados pelo contrato (ADR-019).
