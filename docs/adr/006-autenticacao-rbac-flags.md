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

## Implementação (T12)

- JWT HS256 (`AUTH_JWT_SECRET`) com `aud` = `staff` ou `aluno` e `tid` = tenant; token de outra
  academia é recusado.
- Cookies `gymos_rt_staff` e `gymos_rt_aluno`, host-only, com `Path` `/api/auth/staff` e
  `/api/auth/aluno` (o prefixo global `/api` entra no caminho). Refresh de 7 dias no painel e de 30
  dias no app.
- CSRF no refresh e no logout: exige o cabeçalho `x-gymos-csrf: 1` e recusa `Sec-Fetch-Site:
cross-site` e `Origin` de outro host.
- Senhas com o argon2id do próprio Node (`crypto.argon2`, parâmetros mínimos da OWASP).
- Limite de tentativas em janela deslizante no Redis: 5 erros por conta e 20 por IP em 15 minutos,
  por tenant.
- A permissão é conferida no banco a cada requisição: mudar o tipo de acesso vale na hora.
- Planos: `base` (sem módulos extras) e `completo` (os quatro); a sobrescrita manual por tenant vai
  pelo endpoint interno `PUT /interno/academias/:slug/modulos/:modulo`.

## Alternativas consideradas

- **Sessão no servidor**: mais simples de revogar, mas exige armazenamento de sessão consultado em toda
  requisição.
- **JWT longo em `localStorage`**: exposto a XSS e impossível de revogar.
- **Provedor de identidade externo**: custo e dependência de fornecedor para um fluxo que as telas
  já definem.

## Consequências

- O front renova o token de forma transparente; o back mantém a família de refresh.
- Tentativas sem permissão são auditadas (T13b).
