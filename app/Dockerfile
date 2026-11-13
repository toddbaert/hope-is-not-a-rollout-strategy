FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY app.ts guardrail.ts loadgen.ts index.html ./
# zero-code OTel SDK setup, configured by the OTEL_* env vars in k8s/calculator.yaml
CMD ["node", "--import", "@opentelemetry/auto-instrumentations-node/register", "app.ts"]
