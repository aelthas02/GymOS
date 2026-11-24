#!/usr/bin/env bash
# Uso: tools/deploy/deploy.sh <staging|production> <tag>
# A única parte do pipeline que conhece o provedor de nuvem (ADR-017, ainda não escolhido). Trocar de
# provedor é criar tools/deploy/provedores/<nome>.sh e definir DEPLOY_PROVEDOR=<nome> (variável do
# repositório); o workflow não muda. Sem DEPLOY_PROVEDOR o deploy fica desabilitado e o resto do
# pipeline segue normalmente.
set -euo pipefail

ambiente="${1:-}"
tag="${2:-}"

if [[ "$ambiente" != "staging" && "$ambiente" != "production" ]] || [[ ! "$tag" =~ ^(v[0-9]+\.[0-9]+\.[0-9]+|sha-[0-9a-f]{7,40})$ ]]; then
  echo "Uso: deploy.sh <staging|production> <vX.Y.Z|sha-abcdef0>" >&2
  exit 2
fi

provedor="${DEPLOY_PROVEDOR:-}"
if [[ -z "$provedor" ]]; then
  echo "::notice::Deploy desabilitado: DEPLOY_PROVEDOR não definido (provedor ainda não escolhido, ADR-017). Nada foi implantado em $ambiente ($tag)."
  exit 0
fi

diretorio="${DEPLOY_PROVEDORES_DIR:-$(dirname "${BASH_SOURCE[0]}")/provedores}"
script="$diretorio/$provedor.sh"
if [[ ! -f "$script" ]]; then
  echo "Provedor '$provedor' sem script em $script" >&2
  exit 1
fi

exec bash "$script" "$ambiente" "$tag"
