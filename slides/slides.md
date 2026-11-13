---
theme: '@openfeature/slidev-theme-open-feature'
fonts:
  sans: Poppins
  serif: Architects Daughter
  mono: Fira Code
  provider: none
layout: cover
title: "Hope Is Not a Rollout Strategy: Balancing (AI) Quality, Cost, and Risk Through Experimentation"
---

# Hope Is Not a Rollout Strategy

Balancing (AI) Quality, Cost, and Risk Through Experimentation

<div class="mt-8 opacity-70">Todd Baert</div>

---
layout: intro
---

<div class="flex items-center gap-12">
  <img src="/todd.jpg" class="w-56 h-56 rounded-full object-cover" />
<div>

# Todd Baert

- OpenFeature maintainer
- Principal Software Engineer, Dynatrace

</div>
</div>

---

# AI-powered applications

We use models for fuzzy, complex tasks; that's where the new problems come from

<div class="flex flex-col gap-6 mt-8 mx-16">
<Item v-click title="Non-deterministic output" text="same question, different answers"><ph-target-duotone /></Item>
<Item v-click title="Tokens, per prompt" text="one line prompt change can explode cost"><ph-coins-duotone /></Item>
<Item v-click title="Prompt injection" text="user input is part of the instructions"><ph-shield-warning-duotone /></Item>
<Item v-click title="Lots of knobs" text="model, prompt, temperature, guardrails; each one trades quality, cost and risk"><ph-sliders-horizontal-duotone /></Item>
</div>

<!--
TODO: wording (all draft)
hosted APIs aren't fully deterministic even at temp 0 (batching, floating point); local single-request is
-->

---
layout: section
---

# <ph-flask-duotone class="text-green" /> Everyone tests in production

<div v-click class="mt-8 text-3xl">Some do it <span class="text-green">on purpose</span>.</div>

<!--
say on the way in: you can't test everything
optional anecdote: Friday AI feature launch, Monday fire (from the abstract)
-->

---

# So how do we test in prod safely?

<div class="grid grid-cols-3 gap-8 mt-10 mx-16">
<Card title="Control exposure" text="who gets what"><ph-users-three-duotone /></Card>
<Card title="Measure" text="what's actually happening"><ph-chart-line-up-duotone /></Card>
<Card title="React" text="change it without a deploy"><ph-toggle-right-duotone /></Card>
</div>

<!--
TODO: wording (draft); tool-agnostic on purpose; flags and telemetry come next
-->

---

# From ideas to tools

<div class="grid grid-cols-3 gap-x-8 mt-8 mx-16 text-center">
<div class="opacity-60"><ph-users-three-duotone class="text-3xl" /><p>control exposure</p></div>
<div class="opacity-60"><ph-chart-line-up-duotone class="text-3xl" /><p>measure</p></div>
<div class="opacity-60"><ph-toggle-right-duotone class="text-3xl" /><p>react</p></div>
<div v-for="i in 3" class="mx-auto w-0.5 h-8" style="background: var(--of-green-text)" />
<Card title="OpenFeature + flagd" text="evaluation context, targeting rules, fractional rollouts" />
<Card title="OpenTelemetry" text="feature flag and GenAI semantic conventions" />
<Card title="OpenFeature Operator" text="change a flag, live; no deploy" />
</div>

<!--
TODO: wording (draft)
-->

---

# <ph-flag-duotone class="text-green" /> Feature flags

The maturity model

<div class="flex items-end gap-3 mt-4 mx-8">
<Step :level="0" title="The ENV_VAR swamp" text="change = redeploy" />
<Step :level="1" title="Dynamic configuration" text="change without a deploy; centralize configuration" />
<Step :level="2" title="Dynamic evaluation" text="evaluation logic extracted from code; observable" />
<Step :level="3" title="Operationalized" text="rollouts and experiments drive decisions" />
</div>

<!--
TODO: wording (draft); inspired by the Richardson Maturity Model; the demo lives at 2 and 3
-->

---

# <ph-users-three-duotone class="text-green" /> Control exposure

OpenFeature primitives we use

```ts
// provider: flagd evaluates the targeting rules
await OpenFeature.setProviderAndWait(new FlagdProvider());

// hooks: emit feature_flag.* telemetry on every evaluation
OpenFeature.addHooks(new SpanHook(), new MetricsHook());

// evaluation context: who's asking
const context = { targetingKey: user, plan };

// evaluation API: which model does this user get?
const model = await client.getStringDetails('llm-model', 'qwen2.5:1.5b', context);
```

<!--
TODO: wording (draft); context + provider + evaluation API = control exposure; hooks bridge to measure (next slide)
-->

---

# <ph-chart-line-up-duotone class="text-green" /> Measure

OpenTelemetry semantic conventions

<div class="grid grid-cols-2 gap-6 mt-6">
<div>

### <ph-flag-duotone style="color: var(--of-accent-purple)" /> Feature flags

```sh
feature_flag.key             # which flag
feature_flag.result.variant  # what was served
feature_flag.context.id      # to whom
```

</div>
<div>

### <ph-brain-duotone class="text-green" /> GenAI

```sh
gen_ai.request.model              # which model
gen_ai.usage.input_tokens         # tokens in
gen_ai.usage.output_tokens        # tokens out
gen_ai.client.operation.duration  # how long
```

</div>
</div>

<div class="mt-6 text-sm opacity-60 text-center">both have status "Development" (Nov 2026)</div>

<!--
TODO: wording (draft); only what the demo uses; same attributes on spans and metrics joins flags to model behavior
-->

---

# <ph-toggle-right-duotone class="text-green" /> React

OpenFeature Operator: flags are Kubernetes resources

<div class="grid grid-cols-2 gap-6 mt-4">
<div>

```yaml
# k8s/flags.yaml
kind: FeatureFlag
spec:
  flagSpec:
    flags:
      input-guardrail:
        state: ENABLED
        defaultVariant: "off"
        variants:
          "on": true
          "off": false
```

</div>
<div>

```yaml
# the operator injects a flagd sidecar
annotations:
  openfeature.dev/enabled: "true"
  openfeature.dev/featureflagsource: flag-source
```

```sh
# edit, then apply: live in seconds, no deploy
kubectl apply -f k8s/flags.yaml
```

</div>
</div>

<!--
TODO: wording (draft); flags live next to the workload, versioned in git, changed with the tools you already use
-->

---

# The demo

<div class="mt-8 mx-16 flex flex-col gap-5">
<Item title="A real AI workload" text="real models, real prompts, real tokens"><ph-brain-duotone /></Item>
<Item title="Objective results" text="every answer is right or wrong; quality is measurable"><ph-check-circle-duotone /></Item>
<Item title="Real failure modes" text="wrong answers, token cost, prompt injection"><ph-shield-warning-duotone /></Item>
<Item title="A real cluster" text="Kubernetes (Kind), OpenFeature Operator, flagd, Ollama, Grafana LGTM"><ph-cube-duotone /></Item>
</div>


---

# Test in prod, on purpose

<div class="grid grid-cols-3 gap-8 mt-2 mx-16">
<Card title="Control exposure" text="OpenFeature + flagd" />
<Card title="Measure" text="OpenTelemetry" />
<Card title="React" text="OpenFeature Operator" />
</div>

<div class="mt-6 mx-16 flex flex-col gap-3">
<Item v-click title="Flags + telemetry = test setup + assertions" text="targeting picks who; dashboards decide roll out or roll back"><ph-flask-duotone /></Item>
<Item v-click title="SRE tools are dev tools now" text="all CNCF, all open source; build it next sprint"><ph-wrench-duotone /></Item>
</div>

<!--
TODO: wording (draft)
recap what we decided, on data: guardrail on for everyone (also cut tokens ~30% and nearly doubled throughput); trial gets the cheaper model; temperature 0 rolled out after an experiment on 25% of trial users
-->

---
layout: end
---

# Hope is not a rollout strategy

<div class="text-2xl text-green mt-2">Thank you!</div>

<div class="flex justify-center gap-16 mt-4">
<div class="flex flex-col items-center shrink-0">
<img src="/feedback.png" class="block" style="width: 180px; height: 180px; border: 2px solid var(--of-text); border-radius: 8px; padding: 6px" />
<div class="mt-2 text-sm">Feedback</div>
</div>
<div class="flex flex-col items-center shrink-0">
<QRCode url="https://github.com/toddbaert/hope-is-not-a-rollout-strategy" size="180px" />
<div class="mt-2 text-sm">Repo</div>
</div>
</div>

<div class="flex justify-center gap-8 mt-6 text-sm whitespace-nowrap">
<div><ph-github-logo-duotone class="text-green" /> github.com/toddbaert/hope-is-not-a-rollout-strategy</div>
<div><ph-globe-duotone class="text-green" /> openfeature.dev</div>
<div><ph-slack-logo-duotone class="text-green" /> CNCF Slack #openfeature</div>
</div>

