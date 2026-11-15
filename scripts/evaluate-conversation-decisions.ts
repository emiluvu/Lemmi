import {
  conversationDecisionConfig,
  createOpenRouterDecisionAdapter,
  DECISION_MODELS,
} from '@lemmi/server';
import { conversationDecisionCases } from './fixtures/conversation-decision-cases';

// No calls by default. --live explicitly permits only these committed fictional cases.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--live' && !arg.startsWith('--model='))) {
  console.error(
    'Use --live and optional --model=typesafe/jev-1.14 or --model=openai/gpt-6-luna-decisions',
  );
  process.exit(1);
}
if (!args.includes('--live')) {
  console.info(
    `${conversationDecisionCases.length} fictional cases ready. No provider calls made.`,
  );
  console.info(
    'Run bun scripts/evaluate-conversation-decisions.ts --live --model=MODEL with a private OPENROUTER_API_KEY.',
  );
  process.exit(0);
}
const model =
  args.find((arg) => arg.startsWith('--model='))?.slice('--model='.length) ?? DECISION_MODELS[0];
const configured = conversationDecisionConfig({
  ...process.env,
  LEMMI_DECISIONS_ENABLED: '1',
  LEMMI_DECISIONS_MODEL: model,
});
if (!configured.ok || !configured.data) {
  console.error('Decision evaluation configuration is unavailable or invalid.');
  process.exit(1);
}
const adapter = createOpenRouterDecisionAdapter(configured.data);
const durations: number[] = [];
let passed = 0,
  failed = 0,
  unavailable = 0;
let redirectFalsePositives = 0,
  activityFalsePositives = 0,
  recapFalsePositives = 0;
for (const example of conversationDecisionCases) {
  const began = performance.now();
  const result = await adapter.classify(example.input, new AbortController().signal);
  durations.push(performance.now() - began);
  if (!result.ok) {
    unavailable++;
    continue;
  }
  const actual = result.data,
    expected = example.expected;
  if (actual.redirectTopicIds.length && !expected.redirectTopicIds.length) redirectFalsePositives++;
  if (actual.activity !== 'none' && expected.activity === 'none') activityFalsePositives++;
  if (actual.recap && !expected.recap) recapFalsePositives++;
  const match =
    actual.recap === expected.recap &&
    actual.declinesRedirect === expected.declinesRedirect &&
    actual.activity === expected.activity &&
    [...actual.redirectTopicIds].sort().join(',') ===
      [...expected.redirectTopicIds].sort().join(',');
  if (match) passed++;
  else failed++;
}
durations.sort((a, b) => a - b);
const percentile = (fraction: number) =>
  Math.round(
    durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))] ?? 0,
  );
// Counts only: no utterances, provider bodies, prompts, keys or model reasoning in logs.
console.info(
  JSON.stringify({
    model,
    threshold: configured.data.threshold,
    cases: conversationDecisionCases.length,
    passed,
    failed,
    unavailable,
    redirectFalsePositives,
    activityFalsePositives,
    recapFalsePositives,
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95) },
  }),
);
if (failed || unavailable) process.exitCode = 1;
