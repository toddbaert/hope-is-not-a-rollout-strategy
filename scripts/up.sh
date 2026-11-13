#!/usr/bin/env bash
# creates the cluster from local caches only; run scripts/cache.sh first
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/versions.sh

kind create cluster --config kind.yaml

grep -v '^#' scripts/images.txt | grep -v kindest/node | xargs kind load docker-image --name kubecon
kind load docker-image --name kubecon calculator:dev

kubectl apply -f .cache/cert-manager.yaml
kubectl wait --for=condition=Available deploy --all -n cert-manager --timeout=300s

helm install openfeature ".cache/open-feature-operator-${OFO_VERSION}.tgz" \
  -n open-feature-operator-system --create-namespace --wait \
  --set sidecarConfiguration.image.pullPolicy=IfNotPresent

# retry until the operator's webhook is serving, so the calculator gets its sidecar
until kubectl apply -f k8s/flags.yaml; do sleep 2; done
kubectl apply -f k8s/
kubectl wait --for=condition=Available deploy --all --timeout=300s

# load all models into memory up front
for model in ${MODELS}; do kubectl exec deploy/ollama -- ollama run "${model}" "1+1" >/dev/null 2>&1; done
