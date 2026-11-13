#!/usr/bin/env bash
# a tiny "eval suite": easy questions against each model, the kind of test that passes before release
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/versions.sh

QUESTIONS="7+5 12*3 9-4 6*7 15+27 8*9 100-37 11*11 25+25 20-8"
SYSTEM="You are a calculator. Reply with only the numeric answer."
PORT=11435

kubectl port-forward svc/ollama "${PORT}:11434" >/dev/null 2>&1 &
trap 'kill $!' EXIT
sleep 2

for model in ${MODELS}; do
  passed=0
  for q in ${QUESTIONS}; do
    response=$(curl -s "localhost:${PORT}/api/chat" -d "{\"model\":\"${model}\",\"messages\":[{\"role\":\"system\",\"content\":\"${SYSTEM}\"},{\"role\":\"user\",\"content\":\"${q}\"}],\"stream\":false,\"options\":{\"temperature\":0}}" |
      sed -n 's/.*"content":"\([^"]*\)".*/\1/p')
    actual=$(echo "${response}" | grep -oE -- '-?[0-9]+' | tail -1)
    [ "${actual}" = "$((q))" ] && passed=$((passed + 1))
  done
  total=$(echo ${QUESTIONS} | wc -w)
  status=$([ "${passed}" -eq "${total}" ] && echo PASS || echo FAIL)
  printf "%-14s %s/%s %s\n" "${model}" "${passed}" "${total}" "${status}"
done
