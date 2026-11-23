# ADR-004: Tenant resolvido por subdomínio

- Status: Aceito
- Data: 2026-11-21
- Ticket: T01 (registro); implementação no T11

## Contexto

A tela Entrar mostra "Academia Ritmo" antes do login, então a academia precisa ser conhecida antes da
autenticação. O manifesto do PWA do aluno (nome, ícone e cor) também é por academia.

## Decisão

O tenant é resolvido pelo subdomínio (`ritmo.gymos…`). A API resolve o tenant antes de tocar no banco
e responde 404 quando não encontra. O manifesto do PWA é servido por tenant.

## Alternativas consideradas

- **Tenant no caminho** (`/t/ritmo/...`): funciona, mas polui todas as rotas e o escopo do service
  worker.
- **Tenant só no token**: não atende a tela de login, que precisa da identidade antes do token.
- **Cabeçalho próprio**: não serve para navegação direta nem para o manifesto.

## Consequências

- DNS curinga e certificado curinga em staging e prod (T02).
- Resolução (T11): o slug é o rótulo antes de `TENANT_BASE_DOMAIN` no Host (`ritmo.localhost:3000` →
  `ritmo`). Fora de `NODE_ENV=production`, o cabeçalho `x-tenant` também escolhe o tenant. Host sem
  slug ou com slug desconhecido responde 404 antes de abrir transação.
- Dev usa `*.localhost`, que os navegadores resolvem para 127.0.0.1 sem mexer no arquivo hosts.
- Ficam fora da resolução por Host: `/health`, `/metrics`, `/webhooks/*` (tenant no caminho ou no id
  externo) e `/interno/*` (operação, com chave).
- Slugs reservados (`www`, `api`, `app`, `admin`, `painel`, `static`, `docs`, `mail`, `status`) não
  viram academia.
