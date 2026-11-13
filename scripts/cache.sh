#!/usr/bin/env bash
# downloads everything the demo needs; run once with a good connection
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/versions.sh

mkdir -p .cache .models

grep -v '^#' scripts/images.txt | xargs -n1 docker pull

curl -fsSL -o .cache/cert-manager.yaml \
  "https://github.com/cert-manager/cert-manager/releases/download/${CERT_MANAGER_VERSION}/cert-manager.yaml"

helm pull open-feature-operator --repo https://open-feature.github.io/open-feature-operator/ \
  --version "${OFO_VERSION}" --destination .cache

docker build -t calculator:dev app

# pull models into .models, which kind mounts into the ollama pod
docker rm -f ollama-cache >/dev/null 2>&1 || true
docker run -d --name ollama-cache -v "$PWD/.models:/root/.ollama" "${OLLAMA_IMAGE}" >/dev/null
for model in ${MODELS}; do docker exec ollama-cache ollama pull "${model}"; done
docker rm -f ollama-cache >/dev/null
