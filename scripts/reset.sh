#!/usr/bin/env bash
# restores the demo starting state; --wipe also clears all metrics (wait a few minutes before presenting)
set -euo pipefail
cd "$(dirname "$0")/.."

kubectl apply -f k8s/flags.yaml
kubectl scale deploy/loadgen --replicas=1

if [ "${1:-}" = "--wipe" ]; then
  kubectl rollout restart deploy/lgtm deploy/calculator
  kubectl rollout status deploy/lgtm --timeout=180s
  kubectl rollout status deploy/calculator --timeout=120s
fi
