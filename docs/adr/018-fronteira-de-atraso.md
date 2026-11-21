# ADR-018: Fronteira de atraso

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); `diasDeAtraso` no T19, contrato no T15a, catraca no T23a

## Contexto

Reproduz as telas: Rafael com 6 dias é "Negado" na catraca e "Contrato encerra em 1 dia" na Recepção;
Juliana com 2 dias é "Liberado (tolerância)". Catraca, contrato e cobrança precisam contar o atraso do
mesmo jeito.

## Decisão

`diasDeAtraso` = dias corridos entre o vencimento e hoje no calendário de São Paulo (13/11 → 19/11 =
6). Catraca com "bloquear após N dias" nega quando `diasDeAtraso ≥ N − 1`; contrato com tolerância T
fica em Tolerância de 1 a T−1 e encerra com `≥ T`; reativação até R dias inclusive.

## Alternativas consideradas

- **Dias úteis**: as telas contam dias corridos.
- **Cada domínio calcular o próprio atraso**: geraria divergência entre catraca, Recepção e cobrança.

## Consequências

- Os dias de atraso vêm sempre da função `diasDeAtraso` do domínio de Cobrança (T19), nunca
  recalculados (regras comuns).
- Com bloqueio "após 7 dias", 5 dias de atraso libera na tolerância e 6 nega; com tolerância 7, 6 dias
  fica em Tolerância ("encerra em 1 dia") e 7 encerra.
