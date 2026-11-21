# ADR-017: Hospedagem em contêineres com Postgres e Redis gerenciados no Brasil

- Status: Proposto
- Data: 2026-11-21
- Ticket: T01 (registro); staging e prod no T02 e no T03

## Contexto

O prompt pede três ambientes isolados (dev, staging e prod). Os dados são de academias brasileiras,
incluindo dados de saúde, sob a LGPD.

## Decisão

Contêineres para a API e os frontends, com Postgres e Redis gerenciados em região brasileira. O deploy
fica atrás de `deploy.sh`, para que a troca de provedor não mude o pipeline.

## Premissa

Região brasileira por LGPD e latência; o provedor ainda será escolhido. Em dev, o `docker-compose.yml`
sobe Postgres 16, Redis 7, Mailpit e MinIO.

**Quando decidir:** antes do primeiro deploy em staging.

## Alternativas consideradas

- **Região fora do Brasil**: latência maior e transferência internacional de dados sensíveis.
- **Servidor próprio**: operação e disponibilidade a cargo do time.

## Consequências

- Variáveis de ambiente validadas na inicialização (Zod na API); o mesmo schema vale em todos os
  ambientes.
