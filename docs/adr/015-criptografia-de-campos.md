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

## Implementação (T13c)

- Chave de dados e chave de índice por tenant, envelopadas pela chave mestra em `chave_do_tenant`
  (porta `ProvedorDeChaves`). Em dev e teste a chave mestra vem de `CHAVE_MESTRA_LOCAL`; produção recusa
  a chave local. O adapter do KMS fica para quando o provedor de hospedagem estiver definido (ADR-017).
- Texto cifrado `g1.<versão>.<iv>.<tag>.<dados>`, com `<tenant>|<entidade>.<campo>` como dado
  autenticado. A rotação cria uma nova versão da chave de dados e mantém a de índice.
- Índice cego: `HMAC-SHA256(chave de índice, "<tipo>:<valor normalizado>")` para CPF, e-mail e telefone.
- O descarte de chave por titular não foi implementado: a exclusão é feita pelos provedores de cada
  domínio (`ProvedorDeDadosDoTitular`).
