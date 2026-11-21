# ADR-016: Agente local da catraca como app próprio

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (projeto vazio); núcleo no T24a

## Contexto

As telas exigem pareamento por código, fila offline e sincronização com a catraca. A catraca fica na
rede local da academia e precisa funcionar sem internet.

## Decisão

Um app Node próprio, `apps/turnstile-agent` (tags `scope:agent`, `type:app`), instalado na academia. No
T01 o projeto existe só com build e teste; o núcleo (pareamento, fila e sincronização) chega no T24a.

## Alternativas consideradas

- **No navegador** (WebUSB ou WebSerial): não roda sem a aba aberta e não guarda fila confiável.
- **Na API**: a API não alcança a rede local da academia nem funciona offline.

## Consequências

- As regras de acesso ficam num pacote puro compartilhado (`libs/shared/acesso`, T23a) usado pela API e
  pelo agente.
- O agente tem instalador e atualização assinada próprios (T24b).
