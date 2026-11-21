# ADR-009: Porta para pagamentos, com adapter fake

- Status: Proposto
- Data: 2026-11-21
- Ticket: T01 (registro); porta e fake no T19

## Contexto

As telas usam PIX, cartão, boleto e link de pagamento. O provedor ainda não foi escolhido.

## Decisão

Porta de pagamentos no domínio de cobrança e um adapter **fake determinístico** para dev e testes. O
adapter real entra quando o provedor for escolhido.

## Premissa

Candidatos: Asaas, Pagar.me, Mercado Pago e Stripe. Dev e testes não dependem de provedor.

**Quando decidir:** antes de staging com cobrança.

## Alternativas consideradas

- **Escolher o provedor agora**: travaria o início sem ganho, porque as telas não dependem dele.

## Consequências

- Webhooks do provedor real entram por `runAsTenant` e publicam `PagamentoConfirmado` pelo outbox
  (ADR-007).
