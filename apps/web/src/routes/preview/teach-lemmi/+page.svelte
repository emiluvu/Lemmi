<script lang="ts">
  import TeachingChoices from '#lib/features/TeachingChoices.svelte';
  import AvatarArt from '#lib/features/AvatarArt.svelte';
  import { controlSessionFixture } from '@lemmi/contracts/fixtures';
  import type { SessionSnapshot } from '@lemmi/contracts';
  const session: SessionSnapshot = {
    ...controlSessionFixture,
    mode: 'mock',
    endpoint: 'browser',
    phase: 'ready',
    micMuted: false,
    conversationMode: 'teach_lemmi',
    teaching: {
      mode: 'teach_lemmi',
      entityId: 'topic:gardening',
      assetId: null,
      topicLabel: 'Gardening',
      prompt: 'Would you like to tell me about gardening?',
      presentationId: 'preview-gardening',
      revision: 1,
      policyRevision: 0,
      phase: 'ready',
    },
  };
</script>

<svelte:head><title>Teach Lemmi · design preview</title></svelte:head>
<section class="preview">
  <p class="preview-label">Design preview · fictional Alex · microphone and camera off</p>
  <div class="avatar"><AvatarArt avatarId="lemming" animated /></div>
  <TeachingChoices {session} available speechAvailable command={() => {}} />
  <p class="preview-label">
    In the connected app, Speak now and shared safety controls remain available.
  </p>
</section>

<style>
  .preview {
    max-width: 760px;
    margin: 24px auto;
  }
  .avatar {
    width: min(420px, 85vw);
    aspect-ratio: 1;
    margin: auto;
  }
  .preview-label {
    text-align: center;
    font-size: 16px;
  }
</style>
