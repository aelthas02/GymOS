# ADR-010: Porta para a catraca, com adapter fake

- Status: Proposto
- Data: 2026-11-21
- Ticket: T01 (registro); adapters no T23b e no T24a

## Contexto

As telas de Acesso e o Passo 4 mostram pareamento com catraca por fabricante e modelo. O fabricante
ainda não foi escolhido.

## Decisão

Porta de catraca no agente local (`apps/turnstile-agent`, ADR-016), com adapter **fake determinístico**
para dev e testes e um adapter por fabricante.

## Premissa

O primeiro adapter real é de um fabricante com API HTTP local (por exemplo, Control iD); os demais
vêm depois.

**Quando decidir:** início da fase 3 do Agente 7.

## Alternativas consideradas

- **Integração pela nuvem do fabricante**: nem todo fabricante oferece, e não funciona offline.

## Consequências

- Cada fabricante novo é um adapter, sem mudança no domínio de acesso.
