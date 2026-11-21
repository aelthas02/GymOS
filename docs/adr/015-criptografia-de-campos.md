# ADR-015: Criptografia de campos sensíveis na aplicação

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); implementação no T13c

## Contexto

O GymOS guarda dados de saúde, biometria e CPF. A LGPD exige proteção de dados sensíveis, e o titular
pode pedir exclusão.

## Decisão

Campos sensíveis cifrados na aplicação com **AES-256-GCM** e chave por tenant guardada num KMS. A busca
por CPF usa um índice cego (hash com chave), não o texto.

## Alternativas consideradas

- **pgcrypto no banco**: a chave passaria pelo banco e pelos logs de consulta.
- **Só criptografia de disco**: não protege dumps, backups nem acesso indevido pela aplicação, e não
  permite descartar a chave de um titular.

## Consequências

- Exclusão do titular por descarte de chave quando aplicável.
- A busca aceita CPF completo, nome ou telefone; CPF parcial não é suportado (ver decisões em aberto do
  plano).
