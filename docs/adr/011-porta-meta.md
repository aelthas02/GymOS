# ADR-011: Portas para WhatsApp, Instagram e Facebook (Meta), com adapter fake

- Status: Proposto
- Data: 2026-11-21
- Ticket: T01 (registro); portas e fakes no T13d e no T31a

## Contexto

Recepção, Marketing e mensagens usam WhatsApp, Instagram e Facebook. As telas falam em conectar as
contas oficiais da academia.

## Decisão

Portas `Mensageria` e `ConexoesMeta` com adapter **fake determinístico** para dev e testes; os adapters
reais ficam atrás de flag.

## Premissa

APIs oficiais da Meta (WhatsApp Cloud API e Graph API) com login oficial, como dizem as telas.

**Quando decidir:** antes de staging do Marketing.

## Alternativas consideradas

- **Bibliotecas não oficiais de WhatsApp**: violam os termos da Meta e arriscam bloqueio do número da
  academia.

## Consequências

- Envios respeitam consentimento por finalidade (transacional × marketing) e janela de horário (T13c,
  T31a).
