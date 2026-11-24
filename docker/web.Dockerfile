# syntax=docker/dockerfile:1
# Imagem de produção do staff-web e do student-app (servidor estático nginx). Contexto: raiz do repo.
#   docker build -f docker/web.Dockerfile --build-arg APP=staff-web --build-arg CONFIGURATION=staging \
#     --build-arg RELEASE=v1.2.3 -t gymos-staff-web:v1.2.3 .
# O ambiente (DSN do Sentry, nome) é embutido no build pela `configuration` do Angular; por isso há
# uma imagem por ambiente (staging e production). O mesmo release/tag não é promovido entre eles.

FROM node:26-slim AS build
ARG APP
ARG CONFIGURATION=production
ARG RELEASE=dev
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
ENV NX_DAEMON=false
RUN corepack enable
WORKDIR /repo
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
# --define.GYMOS_RELEASE entrega o release ao Sentry do front (libs/shared/ambiente). O valor precisa
# ser um literal JS; o Nx tira um nível de aspas, por isso as aspas simples por fora.
RUN pnpm nx build "$APP" --configuration="$CONFIGURATION" --skip-nx-cache \
    "--define.GYMOS_RELEASE='\"${RELEASE}\"'"

FROM nginx:1.29-alpine AS runtime
ARG APP
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/dist/apps/${APP}/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
