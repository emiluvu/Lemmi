import {
  conversationDecisionConfig,
  createOpenRouterDecisionAdapter,
  DECISION_MODELS,
  type DecisionDiagnostic,
} from '@lemmi/server';
import {
  conversationDecisionCases,
  heldOutConversationDecisionCases,
  verificationConversationDecisionCases,
} from './fixtures/conversation-decision-cases';

// No calls by default. --live explicitly permits only these committed fictional cases.
const args = process.argv.slice(2);
const suite =
  args.find((arg) => arg.startsWith('--suite='))?.slice('--suite='.length) ?? 'baseline';
const scope =
  args.find((arg) => arg.startsWith('--scope='))?.slice('--scope='.length) ?? 'conversation';
if (
  !['baseline', 'heldout', 'verification', 'all'].includes(suite) ||
  !['activities', 'conversation'].includes(scope) ||
  args.some(
    (arg) =>
      arg !== '--live' &&
      !arg.startsWith('--model=') &&
      !arg.startsWith('--suite=') &&
      !arg.startsWith('--scope='),
  )
) {
  console.error(
    'Use --live, optional --model=MODEL, --scope=activities|conversation and --suite=baseline|heldout|verification|all',
  );
  process.exit(1);
}
const cases =
  suite === 'all'
    ? [
        ...conversationDecisionCases,
        ...heldOutConversationDecisionCases,
        ...verificationConversationDecisionCases,
      ]
    : suite === 'heldout'
      ? heldOutConversationDecisionCases
      : suite === 'verification'
        ? verificationConversationDecisionCases
        : conversationDecisionCases;
if (!args.includes('--live')) {
  console.info(
    `${cases.length} fictional cases ready (${suite}, ${scope}). No provider calls made.`,
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
  LEMMI_DECISIONS_SCOPE: scope,
});
if (!configured.ok || !configured.data) {
  console.error('Decision evaluation configuration is unavailable or invalid.');
  process.exit(1);
}
let diagnostic: DecisionDiagnostic | undefined;
const adapter = createOpenRouterDecisionAdapter(configured.data, fetch, (value) => {
  diagnostic = value;
});
const durations: number[] = [];
let passed = 0,
  failed = 0,
  unavailable = 0;
const fieldMatches = { activity: 0, recap: 0, declinesRedirect: 0, redirectTopicIds: 0 };
let redirectFalsePositives = 0,
  activityFalsePositives = 0,
  recapFalsePositives = 0;
for (const example of cases) {
  const began = performance.now();
  diagnostic = undefined;
  const result = await adapter.classify(example.input, new AbortController().signal);
  if (!result.ok) {
    unavailable++;
    console.info(JSON.stringify({ case: example.id, outcome: 'unavailable', diagnostic }));
    continue;
  }
  durations.push(performance.now() - began);
  const actual = result.data,
    expected =
      scope === 'activities'
        ? {
            recap: false,
            declinesRedirect: false,
            redirectTopicIds: [],
            activity: example.expected.activity,
          }
        : example.expected;
  if (actual.redirectTopicIds.length && !expected.redirectTopicIds.length) redirectFalsePositives++;
  if (actual.activity !== 'none' && expected.activity === 'none') activityFalsePositives++;
  if (actual.recap && !expected.recap) recapFalsePositives++;
  const fields = {
    activity: actual.activity === expected.activity,
    recap: actual.recap === expected.recap,
    declinesRedirect: actual.declinesRedirect === expected.declinesRedirect,
    redirectTopicIds:
      [...actual.redirectTopicIds].sort().join(',') ===
      [...expected.redirectTopicIds].sort().join(','),
  };
  for (const field of Object.keys(fields) as (keyof typeof fields)[])
    if (fields[field]) fieldMatches[field]++;
  // Activity scope still verifies that unrelated decision fields remain inert.
  const match = Object.values(fields).every(Boolean);
  if (match) passed++;
  else {
    failed++;
    console.info(
      JSON.stringify({ case: example.id, outcome: 'mismatch', expected, actual, diagnostic }),
    );
  }
}
durations.sort((a, b) => a - b);
const percentile = (fraction: number) =>
  Math.round(
    durations[Math.min(durations.length - 1, Math.floor(durations.length * fraction))] ?? 0,
  );
// Validated IDs/enums, booleans and numeric diagnostics only: no utterances, provider bodies, prompts, keys or model reasoning.
console.info(
  JSON.stringify({
    model,
    suite,
    scope,
    fieldMatches,
    threshold: configured.data.threshold,
    cases: cases.length,
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
