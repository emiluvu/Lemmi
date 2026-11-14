<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, getContext } from 'svelte';
  import { photoStoryPreviewKey, type PhotoStoryPreviewContext } from '#lib/photo-story-preview.ts';
  import { clients } from '#lib/clients.ts';
  import AvatarArt from '#lib/features/AvatarArt.svelte';
  import PhotoStory from '#lib/features/PhotoStory.svelte';
  import MockParticipant from '#lib/features/MockParticipant.svelte';
  import { activityScreenFixtures } from '@lemmi/contracts/fixtures';
  import type { ParticipantProfile, ActivityView, ActivityAction } from '@lemmi/contracts';
  const photoPreview = activityScreenFixtures.find(
    (view): view is Extract<ActivityView, { activityId: 'photo_album' }> =>
      view.activityId === 'photo_album' && view.phase === 'ready',
  );
  let storyOpen = $state(false);
  let teachingOpen = $state(false);
  let teachingDemo = $state<{ stopForExit: () => Promise<boolean> }>();
  let storyMessage = $state('');
  const photoFiles = getContext<PhotoStoryPreviewContext>(photoStoryPreviewKey);
  let selectedPhotoId = $state<string | null>(null);
  const approvedPhotos = $derived(
    photoFiles.photos.filter((photo) => photo.profileId === profile?.id),
  );
  const selectedPhoto = $derived(
    approvedPhotos.find((photo) => photo.id === selectedPhotoId) ?? approvedPhotos[0] ?? null,
  );
  const currentPhotoPreview = $derived(
    photoPreview && selectedPhoto
      ? {
          ...photoPreview,
          currentAssetId: selectedPhoto.id,
          assetIds: approvedPhotos.map((photo) => photo.id),
          caption: selectedPhoto.caption || 'An approved preview picture.',
        }
      : photoPreview,
  );
  function previewAction(action: ActivityAction) {
    // Presentation-only image selection; no activity reducer or session is running.
    if (
      approvedPhotos.length &&
      (action.type === 'photo.next' || action.type === 'photo.previous')
    ) {
      const index = approvedPhotos.findIndex((photo) => photo.id === selectedPhoto?.id);
      const next =
        (index + (action.type === 'photo.next' ? 1 : -1) + approvedPhotos.length) %
        approvedPhotos.length;
      selectedPhotoId = approvedPhotos[next].id;
      storyMessage = '';
      return;
    }
    if (action.type === 'activity.leave') {
      storyOpen = false;
      storyMessage = '';
      return;
    }
    storyMessage =
      'Picture preview only. AI discussion needs the shared activity host; local pictures are not sent to AI.';
  }
  function previewControl(action: 'pause' | 'stop' | 'help') {
    if (action === 'stop') {
      storyOpen = false;
      storyMessage = '';
    } else
      storyMessage =
        action === 'help'
          ? 'Demo help only — no real message is sent.'
          : 'Design preview only — no audio or activity is running.';
  }
  let profile = $state<ParticipantProfile | null>(null);
  let appearanceError = $state('');
  let appearanceLoading = $state(true);
  async function loadAppearance() {
    appearanceLoading = true;
    appearanceError = '';
    profile = null;
    const result = await clients.profile.load({ profileId: 'profile-alex' });
    if (result.ok) profile = result.data;
    else appearanceError = 'Your companion’s appearance could not be loaded. Please try again.';
    appearanceLoading = false;
  }
  onMount(() => {
    void loadAppearance();
  });
  let exitDialog: HTMLDialogElement;
  let passwordInput: HTMLInputElement;
  let password = $state('');
  let message = $state('');
  let recovery = $state(false);
  function openExit() {
    password = '';
    recovery = false;
    message = '';
    exitDialog.showModal();
    passwordInput?.focus();
  }
  const keys = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ];
  function updatePasscode(value: string) {
    password = value.replace(/\D/g, '').slice(0, 4);
    if (password.length === 4) checkPassword();
  }
  async function checkPassword(event?: SubmitEvent) {
    event?.preventDefault();
    if (password.length !== 4) return;
    if (password === '1234') {
      if (teachingDemo && !(await teachingDemo.stopForExit())) {
        password = '';
        message =
          'Stop could not be confirmed. Close this dialog, refresh shared state, and try Stop again.';
        return;
      }
      password = '';
      exitDialog.close();
      void goto('/caregiver');
    } else {
      password = '';
      exitDialog.close();
      message = 'Incorrect passcode. You’re still with Lemmi.';
    }
  }
</script>

<svelte:head><title>Talk with Lemmi</title></svelte:head>

<section class="conversation-screen" aria-labelledby="conversation-title">
  <div class="conversation-wordmark">Lemmi</div>
  <button
    class="conversation-exit"
    onclick={openExit}
    aria-label="Exit conversation"
    title="Return to dashboard">✕</button
  >
  {#if teachingOpen}
    <div class="teaching-demo">
      <p class="eyebrow">Local scripted text demo · microphone and speaker off</p>
      <MockParticipant bind:this={teachingDemo} />
    </div>
  {:else if storyOpen && currentPhotoPreview && profile}
    <PhotoStory
      view={currentPhotoPreview}
      avatarId={profile.avatarId}
      submit={previewAction}
      control={previewControl}
      photoSrc={selectedPhoto?.url ?? '/images/lemmings-wildflowers.png'}
      approvedPreview={Boolean(selectedPhoto)}
      preview
      message={storyMessage}
    />
  {:else}
    <div class="conversation-center">
      <p class="eyebrow">Your companion</p>
      <h1 id="conversation-title">Talk with Lemmi</h1>
      <div class="conversation-avatar">
        {#if appearanceLoading}<p role="status">Loading your companion…</p>
        {:else if profile}<AvatarArt avatarId={profile.avatarId} />
        {:else}<p role="status">{appearanceError}</p>
          <button class="secondary" onclick={loadAppearance}>Try again</button>{/if}
      </div>
      <h2>Ready when you are</h2>
      <p>Voice conversation is not connected yet.</p>
      <p class="conversation-capture">Microphone off · Camera off</p>
      {#if profile}<button onclick={() => (teachingOpen = true)}>Try Teach Lemmi</button>{/if}
      {#if profile && photoPreview}<button
          class="secondary"
          onclick={() => {
            storyOpen = true;
            storyMessage = '';
          }}>Preview photo story</button
        >{/if}
      <p class="conversation-feedback" role="status" aria-live="polite">{message}</p>
    </div>
  {/if}
</section>

<dialog
  bind:this={exitDialog}
  class="conversation-exit-dialog"
  aria-labelledby="exit-title"
  onclose={() => (password = '')}
>
  <div class="passcode-lock" aria-hidden="true">
    <svg
      width="28"
      height="32"
      viewBox="0 0 28 32"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      ><rect x="4" y="13" width="20" height="16" rx="4" /><path d="M8 13V9a6 6 0 0 1 12 0v4" /></svg
    >
  </div>
  <h2 id="exit-title">Enter Passcode</h2>
  <p class="passcode-subtitle">To return to the caregiver dashboard</p>
  <form onsubmit={checkPassword}>
    <div class="passcode-entry">
      <label class="sr-only" for="exit-password">Four-digit caregiver passcode</label>
      <input
        bind:this={passwordInput}
        id="exit-password"
        type="password"
        inputmode="numeric"
        value={password}
        oninput={(event) => updatePasscode(event.currentTarget.value)}
        maxlength="4"
        pattern="[0-9]{4}"
        autocomplete="off"
        required
      />
    </div>
    <div class="passcode-dots" aria-hidden="true">
      {#each [0, 1, 2, 3] as dot}<span class:filled={password.length > dot}></span>{/each}
    </div>
    <div class="passcode-keypad">
      {#each keys as key}<button
          type="button"
          class="passcode-key"
          aria-label={key.digit}
          onclick={() => updatePasscode(password + key.digit)}
          ><span>{key.digit}</span><small aria-hidden="true">{key.letters}</small></button
        >{/each}
      <span></span><button
        type="button"
        class="passcode-key"
        aria-label="0"
        onclick={() => updatePasscode(password + '0')}><span>0</span></button
      ><button
        type="button"
        class="passcode-delete"
        aria-label="Delete last digit"
        disabled={!password.length}
        onclick={() => (password = password.slice(0, -1))}>⌫</button
      >
    </div>
    <button type="button" class="passcode-cancel quiet" onclick={() => exitDialog.close()}
      >Cancel</button
    >
    <button
      type="button"
      class="quiet"
      onclick={() => (recovery = !recovery)}
      aria-expanded={recovery}
      aria-controls="password-recovery">Forgot passcode?</button
    >
    {#if recovery}<p id="password-recovery" role="status">
        Passcode recovery is not connected in this demo. Ask the person who set up Lemmi for the
        demo passcode.
      </p>{/if}
  </form>
  <p class="helper">Demo exit gate only. This does not secure caregiver data.</p>
</dialog>

<style>
  .teaching-demo {
    width: min(100%, 840px);
    padding: 28px;
    border-radius: 24px;
    background: #fffdf7f5;
    text-align: left;
  }
  :global(body:has(.conversation-screen) .drawer-toggle),
  :global(body:has(.conversation-screen) .app-topbar),
  :global(body:has(.conversation-screen) .app-rail) {
    display: none;
  }
  .conversation-screen {
    position: fixed;
    inset: 0;
    z-index: 10;
    overflow-y: auto;
    padding: 96px 24px 32px;
    background:
      linear-gradient(#fffaf066, #fffaf066),
      #fbf3df url('/images/surfaces/conversation-meadow-v1.png') center / cover no-repeat;
    display: grid;
    place-items: center;
    text-align: center;
  }
  .conversation-exit {
    position: absolute;
    right: max(24px, env(safe-area-inset-right));
    top: 20px;
    width: 56px;
    min-height: 56px;
    padding: 8px;
    border: 1px solid #bdc8aa;
    background: #fffdf7;
    color: #22331f;
    font-size: 24px;
    border-radius: 50%;
    box-shadow:
      inset 0 2px 0 #ffffff,
      0 3px 0 #684b3226,
      0 5px 12px #684b3212;
  }
  .conversation-center {
    display: grid;
    justify-items: center;
    width: min(100%, 720px);
  }
  .conversation-wordmark {
    position: absolute;
    top: 24px;
    left: 32px;
    color: #35482d;
    font-size: 28px;
    font-weight: 750;
    letter-spacing: -1px;
  }
  h1 {
    margin: 4px 0 12px;
    font-size: clamp(32px, 4vw, 44px);
    color: #22331f;
  }
  h2 {
    margin: 16px 0 0;
    font-size: 28px;
  }
  .conversation-center > p {
    margin: 8px 0;
    font-size: 20px;
  }
  .conversation-center > .eyebrow {
    font-size: 14px;
  }
  .conversation-center > button {
    font-size: 20px;
    min-height: 56px;
    margin-top: 16px;
  }
  .conversation-avatar {
    display: block;
    width: min(440px, 100%);
    height: clamp(200px, 34dvh, 340px);
    flex-shrink: 0;
  }
  .conversation-capture {
    color: #2b3c24;
    font-weight: 700;
  }
  .conversation-feedback {
    margin-bottom: 0;
  }
  .conversation-feedback:empty {
    display: none;
  }
  @media (max-height: 700px) {
    .conversation-screen {
      place-items: start center;
    }
    .conversation-avatar {
      height: 180px;
    }
  }
  /* Keep the same layout while calming the scenery behind narrow-screen text. */
  @media (max-width: 600px) {
    .conversation-wordmark {
      left: 24px;
    }
    .conversation-screen {
      background-image:
        linear-gradient(#fff8e34d, #fff8e34d), url('/images/surfaces/conversation-meadow-v1.png');
    }
  }
  .conversation-exit-dialog {
    width: min(400px, calc(100% - 32px));
    max-height: calc(100dvh - 40px);
    padding: 28px;
    border: 1px solid #ffffffb3;
    border-radius: 30px;
    background: #f9faf7f5;
    color: #1f2c1b;
    text-align: center;
    box-shadow: 0 24px 80px #18231533;
  }
  .conversation-exit-dialog::backdrop {
    background: #25362077;
    backdrop-filter: blur(12px);
  }
  .passcode-lock {
    color: #344a29;
  }
  .conversation-exit-dialog h2 {
    margin: 12px 0 8px;
    font-size: 26px;
    font-weight: 650;
  }
  .passcode-subtitle {
    margin: 0;
    font-size: 16px;
    color: #374332;
  }
  .passcode-entry {
    position: relative;
    height: 0;
  }
  .passcode-entry input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 56px;
    opacity: 0;
  }
  .passcode-dots {
    display: flex;
    justify-content: center;
    gap: 22px;
    margin: 0 auto 20px;
    padding: 23px 0;
    border-radius: 12px;
  }
  form:has(input:focus-visible) .passcode-dots {
    outline: 3px solid #899b72;
    outline-offset: 2px;
  }
  .passcode-dots span {
    width: 14px;
    height: 14px;
    border: 1.5px solid #526b43;
    border-radius: 50%;
  }
  .passcode-dots .filled {
    background: #526b43;
  }
  .passcode-keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    justify-items: center;
    max-width: 286px;
    margin: auto;
  }
  .passcode-key {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    min-height: 72px;
    margin: 0;
    padding: 4px;
    border: 0;
    border-radius: 50%;
    background: #e7ebe3;
    color: #1f2c1b;
  }
  .passcode-key span {
    font-size: 30px;
    line-height: 1.1;
    font-weight: 400;
  }
  .passcode-key small {
    height: 13px;
    font-size: 10px;
    line-height: 1.3;
    letter-spacing: 2px;
  }
  .passcode-key:active {
    background: #cdd7c5;
  }
  .passcode-delete {
    background: transparent;
    border: 0;
    color: #2b3c24;
    font-size: 28px;
    padding: 0;
    width: 72px;
    margin: 0;
  }
  .passcode-cancel {
    display: block;
    margin: 16px auto 0;
  }
  .conversation-exit-dialog .quiet {
    font-size: 16px;
    min-height: 44px;
  }
  .conversation-exit-dialog .helper {
    font-size: 13px;
    color: #3d4835;
    margin-bottom: 0;
  }
  #password-recovery {
    font-size: 15px;
  }
</style>
