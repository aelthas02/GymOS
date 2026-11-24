# syntax=docker/dockerfile:1
# Imagem de produção da API. Contexto: raiz do repositório.
#   docker build -f docker/api.Dockerfile --build-arg RELEASE=v1.2.3 -t gymos-api:v1.2.3 .
# A migração de banco NÃO roda aqui: o pipeline a executa antes do deploy (docs/runbooks/deploy.md).

FROM node:26-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
ENV NX_DAEMON=false
# O Node 25+ não traz mais o corepack; instala a versão do `packageManager` do package.json.
RUN npm install -g pnpm@12.21.0
WORKDIR /repo

# Dependências de produção do workspace raiz (o webpack mantém as libs como externas).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts --filter .

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm nx build api --configuration=production --skip-nx-cache

FROM node:26-slim AS runtime
ARG RELEASE=dev
ENV NODE_ENV=production \
    API_PORT=3000 \
    SENTRY_RELEASE=$RELEASE
WORKDIR /app
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/dist/apps/api ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3000)+'/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "main.js"]
