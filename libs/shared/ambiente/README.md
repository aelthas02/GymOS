# @gymos/shared-ambiente

Ambiente e observabilidade dos apps Angular (`staff-web` e `student-app`). Não depende de `libs/ui`.

- `AppEnvironment`: forma dos arquivos `environment.*.ts` de cada app (`name`, `production`,
  `sentryDsn`).
- `EnvironmentBanner` (`<gymos-environment-banner>`): selo discreto "DEV" ou "STAGING" no topo da
  tela; não renderiza nada com `production = true`.
- `correlationIdInterceptor`: envia `x-correlation-id` (UUID novo) em cada requisição para a mesma
  origem, que a API devolve na resposta e grava em todo log.
- `initSentry` e `provideSentry`: Sentry com o ambiente e o release do build; desligado quando
  `sentryDsn` está vazia. O release vem de `GYMOS_RELEASE`, definido no build
  (`--define GYMOS_RELEASE="'staff-web@1.4.0'"`).

Testes: `pnpm nx test shared-ambiente`.
