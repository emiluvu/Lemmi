<script lang="ts">
  import SpeechBubble from '#lib/features/SpeechBubble.svelte';
  import AvatarArt from '#lib/features/AvatarArt.svelte';
  import { avatarChoices, avatarArtwork } from '#lib/avatars.ts';
  import type { AvatarId } from '@lemmi/contracts';
  let avatar = $state<AvatarId>('lemming');
  let expression = $state('base');
</script>

<svelte:head><title>Lemmi avatar preview</title></svelte:head>
<section class="avatar-preview">
  <p class="eyebrow">Local design preview · microphone and camera off</p>
  <h1>Try Lemmi’s faces</h1>
  <label for="preview-animal">Animal</label>
  <select id="preview-animal" bind:value={avatar}>
    {#each avatarChoices as id}<option value={id}>{avatarArtwork[id].label}</option>{/each}
  </select>
  <fieldset>
    <legend>Expression</legend>
    {#each ['base', 'talking', 'thinking'] as state}
      <label
        ><input
          type="radio"
          name="expression"
          value={state}
          bind:group={expression}
        />{state}</label
      >
    {/each}
  </fieldset>
  <div class="character">
    <AvatarArt
      avatarId={avatar}
      animated
      talking={expression === 'talking'}
      thinking={expression === 'thinking'}
    />
  </div>
  {#if expression === 'talking'}<SpeechBubble
      text="We can take our time. What would you like to talk about?"
    />
    <p class="preview-caption-note">Sample caption only · no audio is playing</p>{/if}
  <p>
    Talking holds the mouth open until speech ends. Thinking dots appear one by one. Your system’s
    reduced-motion setting shows all three dots without animation.
  </p>
  <a href="/caregiver">Open caregiver preview →</a>
</section>

<style>
  .avatar-preview {
    max-width: 680px;
    margin: 24px auto;
    padding: 24px;
  }
  .character {
    width: min(440px, 100%);
    aspect-ratio: 1;
    margin: 16px auto;
  }
  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-top: 20px;
  }
  fieldset label {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
  }
  select {
    padding: 12px;
    font: inherit;
    margin-left: 12px;
  }
</style>
