import http from 'node:http';
import { readFileSync } from 'node:fs';
import { OpenFeature } from '@openfeature/server-sdk';
import { FlagdProvider } from '@openfeature/flagd-provider';
import { MetricsHook, SpanHook } from '@openfeature/open-telemetry-hooks';
import { metrics, trace, SpanKind } from '@opentelemetry/api';
import { scan } from './guardrail.ts';

const INDEX_HTML = readFileSync(new URL('index.html', import.meta.url));
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const SERVICE = 'calculator';
const DEFAULT_MODEL = 'qwen2.5:1.5b';
const DEFAULT_VARIANT = 'default';
const MAX_OUTPUT_TOKENS = 128;
const DEFAULT_PROMPT = 'You are a calculator. Reply with only the numeric answer.';
const CONTENT_TYPE = 'content-type';
const OPERATION = 'chat';

OpenFeature.addHooks(new SpanHook(), new MetricsHook());
await OpenFeature.setProviderAndWait(new FlagdProvider());
const client = OpenFeature.getClient();

const tracer = trace.getTracer(SERVICE);
const meter = metrics.getMeter(SERVICE);

// domain metrics
const answers = meter.createCounter('calculator.answers');
const repeats = meter.createCounter('calculator.repeats');
const injections = meter.createCounter('calculator.injections');

// OTel GenAI semantic conventions
const tokenUsage = meter.createHistogram('gen_ai.client.token.usage', { unit: '{token}' });
const duration = meter.createHistogram('gen_ai.client.operation.duration', {
  unit: 's',
  advice: { explicitBucketBoundaries: [0.1, 0.25, 0.5, 1, 2, 4, 8, 16] },
});

const genAiAttributes = (model: string) => ({
  'gen_ai.operation.name': OPERATION,
  'gen_ai.provider.name': 'ollama',
  'gen_ai.request.model': model,
});

// one model call, as a span following the OTel GenAI semantic conventions
async function chat(model: string, temperature: number, prompt: string, promptName: string, question: string) {
  const attributes = { ...genAiAttributes(model), 'gen_ai.request.temperature': temperature, 'gen_ai.prompt.name': promptName };
  return tracer.startActiveSpan(`${OPERATION} ${model}`, { kind: SpanKind.CLIENT, attributes }, async (span) => {
    const start = performance.now();
    try {
      const httpResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: question },
          ],
          stream: false,
          options: { temperature, num_predict: MAX_OUTPUT_TOKENS },
        }),
      });
      const completion = await httpResponse.json();
      span.setAttributes({
        'gen_ai.response.model': completion.model,
        'gen_ai.usage.input_tokens': completion.prompt_eval_count ?? 0,
        'gen_ai.usage.output_tokens': completion.eval_count ?? 0,
        'gen_ai.response.finish_reasons': [completion.done_reason ?? 'stop'],
      });
      return { ...completion, seconds: (performance.now() - start) / 1000 };
    } finally {
      span.end();
    }
  });
}

// objective answer: + - * / with standard precedence
function solve(question: string): number | undefined {
  const expression = question.replaceAll(' ', '');
  const tokens = expression.match(/\d*\.?\d+|[-+*/]/g);
  if (!tokens || tokens.length % 2 === 0 || tokens.join('') !== expression) return undefined;
  const terms: number[] = [];
  let operator = '+';
  for (let index = 0; index < tokens.length; index++) {
    let value = Number(tokens[index]);
    if (Number.isNaN(value)) return undefined;
    if (operator === '*') value = terms.pop()! * value;
    if (operator === '/') value = terms.pop()! / value;
    terms.push(operator === '-' ? -value : value);
    operator = tokens[++index];
    if (operator === undefined) break;
  }
  return terms.reduce((sum, term) => sum + term, 0);
}

// first answer per question and flag variants, across all users; in memory, so it resets on restart
const firstAnswers = new Map<string, number | undefined>();

// consistency: does this answer match the first one given to the same question under the same variants?
function matchesFirstAnswer(variants: object, question: string, answer: number | undefined): boolean | undefined {
  const key = JSON.stringify([variants, question]);
  if (!firstAnswers.has(key)) {
    firstAnswers.set(key, answer);
    return undefined; // first time asked; nothing to compare yet
  }
  return firstAnswers.get(key) === answer;
}

function difficulty(question: string): string {
  const numbers = question.match(/\d+(\.\d+)?/g) ?? [];
  const digits = Math.max(0, ...numbers.map((number) => number.replace('.', '').length));
  return numbers.length > 2 || digits >= 3 ? 'hard' : 'easy';
}

function lastNumber(text: string): number | undefined {
  const numbers = text.replaceAll(',', '').match(/-?\d+(\.\d+)?/g);
  return numbers ? Number(numbers.at(-1)) : undefined;
}

async function handle(request: http.IncomingMessage, response: http.ServerResponse) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/') return response.writeHead(200, { [CONTENT_TYPE]: 'text/html' }).end(INDEX_HTML);
  const question = url.searchParams.get('q');
  if (!question) return response.writeHead(400).end('missing ?q=\n');

  const context = {
    targetingKey: url.searchParams.get('user') || 'anonymous',
    plan: url.searchParams.get('plan') || 'pro',
  };
  const model = await client.getStringDetails('llm-model', DEFAULT_MODEL, context);
  const prompt = await client.getStringDetails('llm-prompt', DEFAULT_PROMPT, context);
  const temperature = await client.getNumberDetails('llm-temperature', 0.8, context);
  const guardrail = await client.getBooleanDetails('input-guardrail', false, context);
  const variants = {
    model: model.variant ?? DEFAULT_VARIANT,
    prompt: prompt.variant ?? DEFAULT_VARIANT,
    temperature: temperature.variant ?? DEFAULT_VARIANT,
    guardrail: guardrail.variant ?? 'off',
  };
  const labels = { ...variants, plan: context.plan };
  const reply = (body: object) =>
    response.writeHead(200, { [CONTENT_TYPE]: 'application/json' }).end(JSON.stringify({ question, ...body, ...variants }) + '\n');

  // anything that isn't pure arithmetic is treated as an injection attempt
  const injection = solve(question) === undefined;
  if (guardrail.value) {
    const verdict = scan(question);
    if (!verdict.valid) {
      if (injection) injections.add(1, { ...labels, result: 'blocked' });
      return reply({ blocked: true, reason: verdict.reason });
    }
  }

  const completion = await chat(model.value, temperature.value, prompt.value, variants.prompt, question);
  const metricAttributes = { ...labels, ...genAiAttributes(model.value) };
  tokenUsage.record(completion.prompt_eval_count ?? 0, { ...metricAttributes, 'gen_ai.token.type': 'input' });
  tokenUsage.record(completion.eval_count ?? 0, { ...metricAttributes, 'gen_ai.token.type': 'output' });
  duration.record(completion.seconds, metricAttributes);
  const answer = String(completion.message?.content ?? '').trim();
  const actual = lastNumber(answer);

  if (injection) {
    // hijacked: the answer is a number the attacker planted, or not a number at all (e.g. a cat poem)
    const expression = question.match(/\d+(?:\s*[-+*/]\s*\d+)+/)?.[0] ?? '';
    const planted = (question.replace(expression, '').match(/\d+/g) ?? []).map(Number);
    const hijacked = actual === undefined || (actual !== solve(expression) && planted.includes(actual));
    injections.add(1, { ...labels, result: hijacked ? 'hijacked' : 'resisted' });
    return reply({ answer, result: actual });
  }

  const expected = solve(question);
  const correct = expected !== undefined && actual !== undefined && Math.abs(actual - expected) < 1e-6;
  answers.add(1, { ...labels, correct, difficulty: difficulty(question) });

  const consistent = matchesFirstAnswer(variants, question, actual);
  if (consistent !== undefined) repeats.add(1, { ...labels, consistent });

  reply({ answer, result: actual, expected, correct });
}

http
  .createServer((request, response) =>
    // request span, so flag evaluations and the model call share one trace
    tracer.startActiveSpan(`${request.method} ${request.url?.split('?')[0]}`, { kind: SpanKind.SERVER }, async (span) => {
      try {
        await handle(request, response);
      } finally {
        span.end();
      }
    }),
  )
  .listen(8080, () => console.log('calculator listening on :8080'));

process.on('SIGTERM', () => process.exit(0));
