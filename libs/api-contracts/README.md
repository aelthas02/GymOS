# @gymos/api-contracts

Contrato da API (ADR-005). Dono: Agente 4 (T11).

- `openapi.json` e `src/generated/schema.ts` são gerados por `pnpm nx run api:openapi` (o
  `@nestjs/swagger` lê os controllers e o `openapi-typescript` gera os tipos). Não edite à mão: o
  `api:openapi-check` do CI falha se divergirem da API.
- `src/lib/cliente-da-api.ts` é o cliente fino sobre o `HttpClient`, tipado por `paths`:
  `inject(CLIENTE_DA_API).get('/api/public/tenant')`. Tipos de DTO: `Schemas['IdentidadeDoTenantDto']`.

Tags `scope:shared` e `type:data-access`: `libs/ui` não importa esta lib. Testes:
`pnpm nx test api-contracts`.
