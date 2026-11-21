# ADR-008: Porta para o emissor fiscal, com adapter fake

- Status: Proposto
- Data: 2026-11-21
- Ticket: T01 (registro); porta e fake no T20

## Contexto

Notas fiscais (NFS-e das mensalidades e NFC-e da Loja) são emitidas por um emissor terceirizado por
API, nunca acoplado a um fornecedor (prompt, item 2). O fornecedor ainda não foi escolhido.

## Decisão

Porta `EmissorFiscal` no domínio de notas e um adapter **fake determinístico** para dev e testes. O
adapter real entra quando o fornecedor for escolhido.

## Premissa

Candidatos a avaliar: Focus NFe, PlugNotas, NFE.io e eNotas, pela cobertura de municípios e pelo
suporte a NFC-e. Dev e testes não dependem de fornecedor.

**Quando decidir:** antes de staging com notas reais.

## Alternativas consideradas

- **Integrar direto com um fornecedor agora**: acoplaria o domínio a uma API que pode mudar.
- **Emissão própria junto às prefeituras**: inviável pela variedade de padrões municipais.

## Consequências

- Idempotência por pagamento no adapter, para não duplicar nota (ver riscos do plano).
- A troca de fornecedor fica restrita a um adapter.
