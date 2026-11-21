# ADR-007: BullMQ com outbox transacional para eventos de domínio

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); implementação no T13a

## Contexto

Eventos como `PagamentoConfirmado → EmitirNota` não podem se perder nem duplicar. Cobrança, notas
fiscais e mensagens rodam em fila (prompt, item 3).

## Decisão

Filas com **BullMQ** sobre o Redis. Eventos de domínio gravados num **outbox** na mesma transação da
mudança que os gera; um publicador lê o outbox e enfileira. Consumidores são idempotentes.

## Alternativas consideradas

- **Publicar direto depois do commit**: perde o evento se o processo cair entre o commit e a
  publicação.
- **Kafka ou RabbitMQ**: mais operação do que o volume exige.
- **pg-boss**: fila no próprio Postgres; viável, mas o Redis já está na stack para cache.

## Consequências

- Os tipos de evento ficam em `libs/shared/events` (T13a).
- Um teste prova que o evento é publicado uma vez mesmo com o worker reiniciado.
