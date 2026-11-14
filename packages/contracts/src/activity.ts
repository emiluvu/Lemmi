import { z } from 'zod';
import {
  IdSchema,
  RevisionSchema,
  EligibilitySnapshotSchema,
  CommunicationSupportSchema,
} from './common';

export const ActivityIdSchema = z.enum([
  'music_playlist',
  'twenty_questions',
  'photo_album',
  'object_matching',
]);
export type ActivityId = z.infer<typeof ActivityIdSchema>;
export const ActivityPhaseSchema = z.enum(['ready', 'active', 'paused', 'ended', 'unavailable']);
export const PlaybackStateSchema = z.enum(['stopped', 'requested', 'playing', 'paused', 'failed']);
export const ActivityPauseReasonSchema = z.enum([
  'participant',
  'camera',
  'help',
  'disconnect',
  'handoff',
  'config_change',
]);
export const ActivityEndReasonSchema = z.enum(['stop', 'session_end', 'revoked']);
export const GuessAnswerSchema = z.enum(['yes', 'no', 'not_sure']);
export const PhotoViewingModeSchema = z.enum(['just_look', 'talk']);

// Issued by the coordinator, never minted by reducers or clients. Null context means no
// current matching presentation; it is not permission to invent one.
export const MatchingPresentationSchema = z.strictObject({
  instanceId: IdSchema,
  presentationId: IdSchema,
  presentationRevision: RevisionSchema,
  policyRevision: RevisionSchema,
});
export type MatchingPresentation = z.infer<typeof MatchingPresentationSchema>;
export const ActivityActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('track.select'), trackId: IdSchema }),
  z.strictObject({
    type: z.enum([
      'track.play',
      'track.pause',
      'track.next',
      'guess.skip',
      'guess.reveal',
      'guess.new_round',
      'photo.next',
      'photo.previous',
      'photo.just_look',
      'photo.talk',
      'match.show',
      'match.not_sure',
      'match.next',
      'match.finish',
      'activity.leave',
    ]),
  }),
  z.strictObject({ type: z.literal('guess.answer'), answer: GuessAnswerSchema }),
  z.strictObject({ type: z.literal('photo.select'), photoId: IdSchema }),
  z.strictObject({ type: z.literal('match.select'), choiceId: IdSchema }),
]);
export type ActivityAction = z.infer<typeof ActivityActionSchema>;
export const ActivityCommandSchema = z
  .strictObject({
    commandId: IdSchema,
    sessionId: IdSchema,
    instanceId: IdSchema,
    expectedRevision: RevisionSchema,
    action: ActivityActionSchema,
    presentation: MatchingPresentationSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action.type.startsWith('match.') && !value.presentation)
      ctx.addIssue({
        code: 'custom',
        path: ['presentation'],
        message: 'Matching requires current presentation evidence',
      });
    if (value.presentation && value.presentation.instanceId !== value.instanceId)
      ctx.addIssue({
        code: 'custom',
        path: ['presentation', 'instanceId'],
        message: 'Presentation instance mismatch',
      });
    if (
      value.presentation &&
      !value.action.type.startsWith('match.') &&
      value.action.type !== 'activity.leave'
    )
      ctx.addIssue({
        code: 'custom',
        path: ['presentation'],
        message: 'Presentation is only valid for matching',
      });
  });
export type ActivityCommand = z.infer<typeof ActivityCommandSchema>;
export const ActivityContextSchema = z
  .strictObject({
    eligibility: EligibilitySnapshotSchema,
    presentationPolicy: CommunicationSupportSchema,
    matchingPresentation: MatchingPresentationSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.matchingPresentation &&
      value.matchingPresentation.policyRevision !== value.eligibility.policyRevision
    )
      ctx.addIssue({
        code: 'custom',
        path: ['matchingPresentation', 'policyRevision'],
        message: 'Presentation policy is stale',
      });
  });
export type ActivityContext = z.infer<typeof ActivityContextSchema>;

const EntityTagsSchema = z.array(IdSchema).min(1).max(20);
const TrackSchema = z.strictObject({
  id: IdSchema,
  title: z.string().min(1).max(100),
  assetId: IdSchema,
  entityIds: EntityTagsSchema,
});
export const GuessTerminalSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('guess'), candidateId: IdSchema }),
  z.strictObject({ kind: z.literal('round_end') }),
]);
export const GuessBranchSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('question'), questionId: IdSchema }),
  ...GuessTerminalSchema.options,
]);
export const GuessCandidateSchema = z.strictObject({
  id: IdSchema,
  label: z.string().min(1).max(100),
  assetId: IdSchema.nullable(),
  entityIds: EntityTagsSchema,
});
export const GuessQuestionSchema = z.strictObject({
  id: IdSchema,
  prompt: z.string().min(1).max(300),
  entityIds: EntityTagsSchema,
  branches: z.strictObject({
    yes: GuessBranchSchema,
    no: GuessBranchSchema,
    not_sure: GuessBranchSchema,
    skip: GuessBranchSchema,
  }),
});
export const GuessRoundSchema = z.strictObject({
  id: IdSchema,
  candidateIds: z.array(IdSchema).min(1).max(20),
  entryQuestionId: IdSchema,
  reveal: GuessTerminalSchema,
});
export const PhotoEntrySchema = z.strictObject({
  id: IdSchema,
  assetId: IdSchema,
  caption: z.string().max(300).nullable(),
  // Approved server-side discussion context. Never copied into a participant view.
  discussionContext: z.string().max(1000).nullable(),
  entityIds: EntityTagsSchema,
});
export const MatchingCardSchema = z
  .strictObject({
    id: IdSchema,
    entityId: IdSchema,
    assetId: IdSchema,
    entityIds: EntityTagsSchema,
  })
  .refine((card) => card.entityIds.includes(card.entityId), {
    path: ['entityIds'],
    message: 'Tags must include the canonical object',
  });
const PackBase = { id: IdSchema, version: z.literal(1), approved: z.literal(true) };
export const ApprovedPackSchema = z
  .discriminatedUnion('activityId', [
    z.strictObject({
      ...PackBase,
      activityId: z.literal('music_playlist'),
      tracks: z.array(TrackSchema).min(1).max(20),
    }),
    z.strictObject({
      ...PackBase,
      activityId: z.literal('twenty_questions'),
      candidates: z.array(GuessCandidateSchema).min(1).max(20),
      questions: z.array(GuessQuestionSchema).min(1).max(20),
      rounds: z.array(GuessRoundSchema).min(1).max(20),
    }),
    z.strictObject({
      ...PackBase,
      activityId: z.literal('photo_album'),
      collectionKind: z.enum(['album', 'place_scenes']),
      entries: z.array(PhotoEntrySchema).max(20),
    }),
    z.strictObject({
      ...PackBase,
      activityId: z.literal('object_matching'),
      cards: z.array(MatchingCardSchema).max(20),
    }),
  ])
  .superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const unique = (ids: string[], path: (string | number)[]) => {
      if (new Set(ids).size !== ids.length) issue(path, 'IDs must be unique');
    };
    if (pack.activityId === 'music_playlist')
      unique(
        pack.tracks.map((v) => v.id),
        ['tracks'],
      );
    if (pack.activityId === 'photo_album')
      unique(
        pack.entries.map((v) => v.id),
        ['entries'],
      );
    if (pack.activityId === 'object_matching')
      unique(
        pack.cards.map((v) => v.id),
        ['cards'],
      );
    if (pack.activityId !== 'twenty_questions') return;
    unique(
      pack.candidates.map((v) => v.id),
      ['candidates'],
    );
    unique(
      pack.questions.map((v) => v.id),
      ['questions'],
    );
    unique(
      pack.rounds.map((v) => v.id),
      ['rounds'],
    );
    const candidates = new Set(pack.candidates.map((v) => v.id));
    const questions = new Map(pack.questions.map((v) => [v.id, v]));
    for (const [index, question] of pack.questions.entries()) {
      for (const [answer, branch] of Object.entries(question.branches)) {
        if (
          (branch.kind === 'question' && !questions.has(branch.questionId)) ||
          (branch.kind === 'guess' && !candidates.has(branch.candidateId))
        )
          issue(['questions', index, 'branches', answer], 'Unknown reviewed reference');
      }
    }
    // Acyclic graph + at most 20 nodes bounds every round to at most 20 questions.
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string): void => {
      if (visiting.has(id)) {
        issue(['questions'], 'Question cycles are forbidden');
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      const question = questions.get(id);
      if (question)
        for (const branch of Object.values(question.branches))
          if (branch.kind === 'question') visit(branch.questionId);
      visiting.delete(id);
      visited.add(id);
    };
    for (const question of pack.questions) visit(question.id);
    const reachable = new Set<string>();
    for (const [index, round] of pack.rounds.entries()) {
      unique(round.candidateIds, ['rounds', index, 'candidateIds']);
      if (round.candidateIds.some((id) => !candidates.has(id)))
        issue(['rounds', index, 'candidateIds'], 'Unknown reviewed candidate');
      if (!questions.has(round.entryQuestionId))
        issue(['rounds', index, 'entryQuestionId'], 'Unknown entry question');
      if (round.reveal.kind === 'guess' && !round.candidateIds.includes(round.reveal.candidateId))
        issue(['rounds', index, 'reveal'], 'Reveal must reference a candidate in this round');
      const seen = new Set<string>();
      const checkRound = (id: string): void => {
        if (seen.has(id)) return;
        seen.add(id);
        reachable.add(id);
        const question = questions.get(id);
        if (!question) return;
        for (const branch of Object.values(question.branches)) {
          if (branch.kind === 'question') checkRound(branch.questionId);
          if (branch.kind === 'guess' && !round.candidateIds.includes(branch.candidateId))
            issue(['rounds', index], 'Branch guess is outside the round candidate set');
        }
      };
      checkRound(round.entryQuestionId);
    }
    if (pack.questions.some((question) => !reachable.has(question.id)))
      issue(['questions'], 'Every question must belong to a reviewed round');
  });
export type ApprovedPack = z.infer<typeof ApprovedPackSchema>;

const StateBase = { instanceId: IdSchema, revision: RevisionSchema, phase: ActivityPhaseSchema };
export const ActivityStateSchema = z
  .discriminatedUnion('activityId', [
    z.strictObject({
      ...StateBase,
      activityId: z.literal('music_playlist'),
      currentTrackId: IdSchema.nullable(),
      playback: PlaybackStateSchema,
    }),
    z.strictObject({
      ...StateBase,
      activityId: z.literal('twenty_questions'),
      roundId: IdSchema.nullable(),
      questionId: IdSchema.nullable(),
      guessCandidateId: IdSchema.nullable(),
      roundPhase: z.enum(['ready', 'asking', 'guess_offered', 'complete']),
      questionsAsked: z.number().int().min(0).max(20),
    }),
    z.strictObject({
      ...StateBase,
      activityId: z.literal('photo_album'),
      currentPhotoId: IdSchema.nullable(),
      position: z.number().int().min(0).max(19).nullable(),
      viewingMode: PhotoViewingModeSchema,
    }),
    z.strictObject({
      ...StateBase,
      activityId: z.literal('object_matching'),
      sampleCardId: IdSchema.nullable(),
      choiceIds: z.array(IdSchema).max(2),
      selectedChoiceId: IdSchema.nullable(),
      pairShown: z.boolean(),
      presentation: MatchingPresentationSchema.nullable(),
    }),
  ])
  .superRefine((state, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (
      state.activityId === 'photo_album' &&
      (state.currentPhotoId === null) !== (state.position === null)
    )
      issue('position', 'Photo ID and position must both be present or both empty');
    if (state.activityId === 'twenty_questions') {
      if (
        state.roundPhase === 'asking' &&
        (!state.roundId ||
          !state.questionId ||
          state.guessCandidateId !== null ||
          state.questionsAsked === 0)
      )
        issue('questionId', 'Asking requires a current round/question and no offered guess');
      if (
        state.roundPhase === 'guess_offered' &&
        (!state.roundId || !state.guessCandidateId || state.questionId !== null)
      )
        issue(
          'guessCandidateId',
          'An offered guess requires a current round/candidate and no question',
        );
      if (
        (state.roundPhase === 'ready' || state.roundPhase === 'complete') &&
        (state.questionId !== null || state.guessCandidateId !== null)
      )
        issue('roundPhase', 'Ready/complete cannot retain a current question or guess');
    }
    if (state.activityId !== 'object_matching') return;
    if (new Set(state.choiceIds).size !== state.choiceIds.length)
      issue('choiceIds', 'Matching choices must be distinct');
    if (state.sampleCardId !== null && (state.choiceIds.length !== 2 || !state.presentation))
      issue('choiceIds', 'A sample requires two choices and coordinator presentation evidence');
    if (
      state.sampleCardId === null &&
      (state.choiceIds.length || state.selectedChoiceId !== null || state.pairShown)
    )
      issue('sampleCardId', 'Empty presentation cannot retain choices, selection or reveal');
    if (state.selectedChoiceId !== null && !state.choiceIds.includes(state.selectedChoiceId))
      issue('selectedChoiceId', 'Selection must be a displayed choice');
    if (state.presentation && state.presentation.instanceId !== state.instanceId)
      issue('presentation', 'Presentation belongs to another instance');
  });
export type ActivityState = z.infer<typeof ActivityStateSchema>;

const ViewBase = {
  ...StateBase,
  title: z.string().max(100),
  prompt: z.string().max(300).nullable(),
  assetIds: z.array(IdSchema).max(20),
  choices: z
    .array(
      z.strictObject({ id: IdSchema, label: z.string().max(100), action: ActivityActionSchema }),
    )
    .max(20),
  capabilities: z.strictObject({ audioRequired: z.boolean(), largeScreenPreferred: z.boolean() }),
};
export const ActivityViewSchema = z
  .discriminatedUnion('activityId', [
    z.strictObject({
      ...ViewBase,
      activityId: z.literal('music_playlist'),
      currentTrackId: IdSchema.nullable(),
      playback: PlaybackStateSchema,
    }),
    z.strictObject({
      ...ViewBase,
      activityId: z.literal('twenty_questions'),
      question: z.string().max(300).nullable(),
      offeredGuess: z
        .strictObject({ label: z.string().max(100), assetId: IdSchema.nullable() })
        .nullable(),
      roundPhase: z.enum(['ready', 'asking', 'guess_offered', 'complete']),
    }),
    z.strictObject({
      ...ViewBase,
      activityId: z.literal('photo_album'),
      currentAssetId: IdSchema.nullable(),
      caption: z.string().max(300).nullable(),
      viewingMode: PhotoViewingModeSchema,
    }),
    z.strictObject({
      ...ViewBase,
      activityId: z.literal('object_matching'),
      sampleAssetId: IdSchema.nullable(),
      candidateAssetIds: z.array(IdSchema).max(2),
      presentation: MatchingPresentationSchema.nullable(),
      pairShown: z.boolean(),
    }),
  ])
  .superRefine((view, ctx) => {
    if (view.activityId !== 'object_matching') return;
    if (view.presentation && view.presentation.instanceId !== view.instanceId)
      ctx.addIssue({
        code: 'custom',
        path: ['presentation'],
        message: 'Presentation instance mismatch',
      });
    if (view.sampleAssetId !== null && (!view.presentation || view.candidateAssetIds.length !== 2))
      ctx.addIssue({
        code: 'custom',
        path: ['candidateAssetIds'],
        message: 'A sample requires two candidates and a presentation',
      });
    if (view.sampleAssetId === null && (view.candidateAssetIds.length || view.pairShown))
      ctx.addIssue({
        code: 'custom',
        path: ['sampleAssetId'],
        message: 'Empty sample cannot retain candidates or reveal',
      });
  });
export type ActivityView = z.infer<typeof ActivityViewSchema>;

// Shape validation is not receipt authentication. The coordinator must bind these to the
// committed effect, current output lease/generation/policy and increasing endpoint sequence.
export const PlaybackReceiptSchema = z.strictObject({
  instanceId: IdSchema,
  effectId: IdSchema,
  generation: RevisionSchema,
  leaseId: IdSchema,
  sequence: RevisionSchema,
  status: z.enum(['playing', 'paused', 'ended', 'failed']),
});
export type ValidatedPlaybackReceipt = z.infer<typeof PlaybackReceiptSchema>;
export const ActivitySystemInputSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('system.pause'), reason: ActivityPauseReasonSchema }),
  z.strictObject({ type: z.enum(['system.resume', 'system.eligibility_changed']) }),
  z.strictObject({ type: z.literal('system.end'), reason: ActivityEndReasonSchema }),
  z.strictObject({ type: z.literal('system.playback_receipt'), receipt: PlaybackReceiptSchema }),
]);
export type ActivitySystemInput = z.infer<typeof ActivitySystemInputSchema>;
export const ActivityEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('play_approved_track'), assetId: IdSchema }),
  z.strictObject({ type: z.enum(['stop_media', 'request_listening']) }),
  z.strictObject({ type: z.literal('speak_approved_text'), textId: IdSchema }),
  z.strictObject({
    type: z.literal('offer_photo_conversation'),
    photoId: IdSchema,
    assetId: IdSchema,
  }),
  z.strictObject({
    type: z.literal('preference.signal'),
    entityId: IdSchema,
    signal: z.enum(['prefer', 'avoid']),
    presentation: MatchingPresentationSchema,
  }),
  z.strictObject({
    type: z.literal('item.uncertain'),
    entityId: IdSchema,
    presentation: MatchingPresentationSchema,
  }),
]);
export type ActivityEffect = z.infer<typeof ActivityEffectSchema>;

// Factual IDs/enums only. No utterances, free-text notes, hidden answers, or ability scores.
export const ActivityEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.enum(['activity_started', 'activity_ended', 'activity_resumed']) }),
  z.strictObject({ type: z.literal('activity_paused'), reason: ActivityPauseReasonSchema }),
  z.strictObject({ type: z.literal('eligibility_changed'), policyRevision: RevisionSchema }),
  z.strictObject({
    type: z.enum([
      'track_selected',
      'track_play_requested',
      'track_pause_requested',
      'question_skipped',
      'guess_offered',
      'guess_round_ended',
      'photo_selected',
      'photo_talk_requested',
      'photo_just_look',
      'match_presented',
      'match_selected',
      'match_shown',
      'match_next',
      'match_finished',
    ]),
    itemId: IdSchema,
  }),
  z.strictObject({
    type: z.literal('question_answered'),
    itemId: IdSchema,
    answer: GuessAnswerSchema,
  }),
  z.strictObject({
    type: z.literal('track_played'),
    itemId: IdSchema,
    receipt: PlaybackReceiptSchema.extend({ status: z.literal('playing') }),
  }),
  z.strictObject({
    type: z.literal('track_paused'),
    itemId: IdSchema,
    receipt: PlaybackReceiptSchema.extend({ status: z.literal('paused') }),
  }),
  z.strictObject({
    type: z.literal('track_ended'),
    itemId: IdSchema,
    receipt: PlaybackReceiptSchema.extend({ status: z.literal('ended') }),
  }),
  z.strictObject({
    type: z.literal('media_failed'),
    itemId: IdSchema,
    receipt: PlaybackReceiptSchema.extend({ status: z.literal('failed') }),
  }),
]);
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export const ActivityTransitionSchema = z
  .strictObject({
    nextState: ActivityStateSchema,
    events: z.array(ActivityEventSchema).max(100),
    effects: z.array(ActivityEffectSchema).max(40),
  })
  .superRefine((transition, ctx) => {
    for (const [index, event] of transition.events.entries())
      if ('receipt' in event && event.receipt.instanceId !== transition.nextState.instanceId)
        ctx.addIssue({
          code: 'custom',
          path: ['events', index, 'receipt'],
          message: 'Receipt instance mismatch',
        });
    for (const [index, effect] of transition.effects.entries())
      if (
        'presentation' in effect &&
        effect.presentation.instanceId !== transition.nextState.instanceId
      )
        ctx.addIssue({
          code: 'custom',
          path: ['effects', index],
          message: 'Signal presentation instance mismatch',
        });
  });
export type ActivityTransition = z.infer<typeof ActivityTransitionSchema>;
export const StartActivityInputSchema = z.strictObject({ instanceId: IdSchema });
export type StartActivityInput = z.infer<typeof StartActivityInputSchema>;
