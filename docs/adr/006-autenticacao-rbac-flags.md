# ADR-006: JWT curto, refresh rotativo em cookie, RBAC por permissão e flags por tenant

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); implementação no T12

## Contexto

O prompt pede JWT de acesso curto com refresh em cookie `HttpOnly`/`Secure`/`SameSite`, RBAC por
permissão (tela Permissões) e módulos extras ligados por plano contratado. O aluno entra com CPF ou
e-mail.

## Decisão

- Token de acesso JWT de **10 minutos**.
- Refresh **rotativo** em cookie `HttpOnly; Secure; SameSite=Lax`; reutilizar um refresh revoga a
  família de tokens.
- **RBAC por permissão** (`@RequirePermission` no back, `appPermission` no front; o back sempre
  verifica).
- **Feature flags por tenant**, derivadas do plano contratado; rota de módulo desligado responde 404.
- O login do aluno aceita CPF (com ou sem pontuação) ou e-mail no mesmo campo.

## Alternativas consideradas

- **Sessão no servidor**: mais simples de revogar, mas exige armazenamento de sessão consultado em toda
  requisição.
- **JWT longo em `localStorage`**: exposto a XSS e impossível de revogar.
- **Provedor de identidade externo**: custo e dependência de fornecedor para um fluxo que as telas
  já definem.

## Consequências

- O front renova o token de forma transparente; o back mantém a família de refresh.
- Tentativas sem permissão são auditadas (T13b).
