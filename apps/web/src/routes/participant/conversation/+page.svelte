<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, getContext } from 'svelte';
  import { photoStoryPreviewKey, type PhotoStoryPreviewContext } from '#lib/photo-story-preview.ts';
  import { clients } from '#lib/clients.ts';
  import AvatarArt from '#lib/features/AvatarArt.svelte';
  import PhotoStory from '#lib/features/PhotoStory.svelte';
  import { activityScreenFixtures } from '@lemmi/contracts/fixtures';
  import type { ParticipantProfile, ActivityView, ActivityAction } from '@lemmi/contracts';
  const photoPreview = activityScreenFixtures.find(
    (view): view is Extract<ActivityView, { activityId: 'photo_album' }> =>
      view.activityId === 'photo_album' && view.phase === 'ready',
  );
  let storyOpen = $state(false);
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
    photoPreview
      ? {
          ...photoPreview,
          currentAssetId: selectedPhoto?.id ?? null,
          assetIds: selectedPhoto ? [selectedPhoto.id] : [],
          caption: selectedPhoto?.caption || null,
          choices: photoPreview.choices.filter(
            (choice) => !['photo.next', 'photo.previous'].includes(choice.action.type),
          ),
        }
      : null,
  );
  function previewAction(action: ActivityAction) {
    if (action.type === 'activity.leave') {
      storyOpen = false;
      storyMessage = '';
      return;
    }
    storyMessage =
      'Picture preview only. AI discussion needs the shared activity host; these local images are not sent to AI.';
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
  function checkPassword(event?: SubmitEvent) {
    event?.preventDefault();
    if (password.length !== 4) return;
    if (password === '1234') {
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

<section
  class="conversation-screen"
  aria-labelledby={storyOpen ? 'photo-story-title' : 'conversation-title'}
>
  <button
    class="conversation-exit"
    onclick={openExit}
    aria-label="Exit conversation"
    title="Return to dashboard">✕</button
  >
  {#if storyOpen && currentPhotoPreview && profile}
    <div class="story-preview-layout">
      {#if approvedPhotos.length > 1}<div
          class="story-photo-strip"
          role="group"
          aria-label="Choose an approved preview picture"
        >
          {#each approvedPhotos as photo, index}<button
              type="button"
              class="secondary"
              aria-pressed={selectedPhoto?.id === photo.id}
              onclick={() => {
                selectedPhotoId = photo.id;
                storyMessage = '';
              }}><img src={photo.url} alt="" /><span>Picture {index + 1}</span></button
            >{/each}
        </div>{/if}
      <PhotoStory
        view={currentPhotoPreview}
        avatarId={profile.avatarId}
        submit={previewAction}
        control={previewControl}
        photoSrc={selectedPhoto?.url ?? null}
        preview
        message={storyMessage}
      />
    </div>
  {:else}
    <div class="conversation-center">
      <p class="eyebrow">Your AI companion</p>
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
</dialog>

<style>
  :global(body:has(.conversation-screen) .drawer-toggle),
  :global(body:has(.conversation-screen) .app-rail) {
    display: none;
  }
  .conversation-screen {
    position: fixed;
    inset: 0;
    z-index: 10;
    overflow-y: auto;
    padding: 64px 24px 32px;
    background: radial-gradient(ellipse at center, #fbf8ef, #edf0e3 62%, #e0e6d1);
    display: grid;
    place-items: center;
    text-align: center;
  }
  .conversation-exit {
    position: absolute;
    right: 24px;
    top: 16px;
    width: 56px;
    min-height: 56px;
    padding: 8px;
    border: 1px solid #bdc8aa;
    background: #fffdf7;
    color: #22331f;
    font-size: 24px;
    border-radius: 50%;
  }
  .conversation-center {
    display: grid;
    justify-items: center;
    width: min(100%, 640px);
  }
  .story-preview-layout {
    width: min(100%, 1040px);
  }
  .story-photo-strip {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .story-photo-strip button {
    display: grid;
    justify-items: center;
    padding: 8px 12px;
    font-size: 16px;
  }
  .story-photo-strip img {
    width: 72px;
    height: 54px;
    object-fit: contain;
  }
  .story-photo-strip button[aria-pressed='true'] {
    border: 3px solid var(--outline-brown);
    background: #e0e9cf;
  }
  h1 {
    margin: 4px 0 24px;
    font-size: clamp(32px, 5vw, 52px);
    color: #22331f;
  }
  h2 {
    margin: 24px 0 0;
  }
  .conversation-center > p {
    margin: 8px 0;
  }
  .conversation-avatar {
    display: block;
    width: min(560px, 90vw);
    height: clamp(260px, 48vh, 480px);
    flex-shrink: 0;
  }
  .conversation-capture {
    color: #2b3c24;
    font-weight: 700;
  }
  .conversation-feedback {
    min-height: 2em;
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
  #password-recovery {
    font-size: 15px;
  }
</style>
