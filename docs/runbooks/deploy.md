# Deploy

Pipeline em `.github/workflows/deploy.yml`. O PR roda `pr.yml` (lint, teste, cobertura, build com
budgets, relatório de bundle, Lighthouse).

| Gatilho              | Imagens                                   | Ambiente                             |
| -------------------- | ----------------------------------------- | ------------------------------------ |
| merge/push na `main` | `gymos-{api,staff-web,student-app}:sha-*` | staging (automático)                 |
| tag `vX.Y.Z`         | as mesmas, com a tag `vX.Y.Z`             | production, **com aprovação manual** |

Promover para produção: `git tag v1.2.3 && git push origin v1.2.3`. O job `implantar` espera a
aprovação dos revisores do GitHub Environment `production` (Settings → Environments → production →
Required reviewers). As imagens de produção são reconstruídas com `--configuration=production`
porque o ambiente do front (nome, DSN do Sentry) é embutido no build.

## Passos de cada deploy

1. **Imagens** (`docker/api.Dockerfile`, `docker/web.Dockerfile`), publicadas no GHCR. O `docker build`
   não pôde ser executado na máquina de desenvolvimento (sem Docker): os Dockerfiles foram validados
   só estaticamente e o primeiro build real acontece no workflow.
2. **Migração** (`pnpm nx run api:migrar`, papel `gymos_migrator`), antes de trocar a imagem. Pulada
   enquanto `DATABASE_MIGRATOR_URL` não existe no Environment. Rollback: `docs/runbooks/rollback.md`.
3. **Deploy**: `tools/deploy/deploy.sh <ambiente> <tag>`. Sem a variável de repositório
   `DEPLOY_PROVEDOR` ele só avisa que está desabilitado. Para ligar um provedor, crie
   `tools/deploy/provedores/<nome>.sh` (recebe ambiente e tag) e defina `DEPLOY_PROVEDOR=<nome>`.

## Configuração por ambiente (Environments `staging` e `production`)

| Nome                    | Tipo     | Para quê                                                              |
| ----------------------- | -------- | --------------------------------------------------------------------- |
| `DEPLOY_PROVEDOR`       | variável | nome do script de provedor; vazio desabilita o deploy                 |
| `DATABASE_MIGRATOR_URL` | segredo  | conexão do `gymos_migrator`; habilita a migração                      |
| variáveis da API        | provedor | as do `.env.example`, definidas no provedor (nunca na imagem)         |
| `SENTRY_DSN`            | provedor | DSN da API; o `SENTRY_RELEASE` já vem da imagem (= a tag)             |
| DSN do Sentry do front  | código   | `apps/*/src/environments/environment.{staging,prod}.ts` (`sentryDsn`) |

- **Release do Sentry no front:** o build recebe `--define.GYMOS_RELEASE='"<tag>"'` (ver
  `docker/web.Dockerfile`); o Nx tira um nível de aspas, por isso as aspas dentro das aspas.
- **`TRUST_PROXY_HOPS`:** quantos proxies confiáveis ficam na frente da API (normalmente `1`: o
  ingress do provedor). Com `0` o `X-Forwarded-For` é ignorado e os limites de login por IP (T12)
  veem todos os clientes como o IP do proxy. Defina no provedor junto com o resto do ambiente.
- **`/metrics` só na rede interna:** a API devolve 404 para requisição com `X-Forwarded-For` ou
  `X-Forwarded-Host`, que o ingress público sempre acrescenta. Configure o Prometheus para raspar o
  endereço interno da API (sem passar pelo ingress) e **não** crie rota pública para `/metrics`.
- **Banco e papéis:** uma vez por ambiente, `pnpm gymos preparar-banco` com a conta administrativa
  (cria `gymos_migrator` e `gymos_app`); depois o pipeline cuida das migrações.

## DNS e certificado curinga (só documentado)

O provedor de nuvem ainda não foi escolhido (ADR-017), então nada disto foi criado. Quando for:

- Registros: `*.staging.<domínio>` e `*.<domínio>` apontando para o ingress do front (staff-web e
  student-app, por subdomínio de academia) e `api.staging.<domínio>` e `api.<domínio>` para a API.
  O tenant vem do subdomínio (ADR-004); `TENANT_BASE_DOMAIN` precisa bater com o domínio de cada ambiente.
- Certificado curinga (`*.<domínio>` e `*.staging.<domínio>`) por desafio DNS-01 (Let's Encrypt pelo
  gerenciador do provedor ou cert-manager), com renovação automática.
- `STAFF_WEB_URL` e `STUDENT_APP_URL` usam `{tenant}` no lugar do slug, por exemplo
  `https://{tenant}.<domínio>`.

## Portões de qualidade (resumo)

- Cobertura: 85% de linhas e 80% de branches no geral; 100% em `libs/shared/{money,validation,pipes,
forms,templates}`, `libs/ui/styles/contrast.ts`, pastas `domain/` da API e
  `apps/turnstile-agent/src/domain`. O job `portoes` planta código sem teste em cada pasta e confere
  que o teste falha.
- Budgets: o `angular.json` mede o bruto (aviso em 600 kB, erro em 750 kB de JS inicial); o limite do
  ticket, **250 kB de JS inicial e 80 kB por chunk lazy comprimidos**, é conferido por
  `tools/architecture/ci/bundle-report.ts`, que também gera o relatório publicado como artefato.
- Lighthouse CI (`lighthouserc.cjs`): Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95 e
  SEO ≥ 90 só nas páginas públicas. Roda quando a rota `entrar` existir (T07); as rotas autenticadas
  entram com o seed (T35).
