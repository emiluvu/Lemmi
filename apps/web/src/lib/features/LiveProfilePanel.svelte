<script lang="ts">
  import { onMount } from 'svelte';
  import AvatarArt from './AvatarArt.svelte';
  import ProfileContextForm from './ProfileContextForm.svelte';
  import type { ProfileContextView } from '@lemmi/contracts';
  import { clients } from '#lib/clients.ts';
  import { avatarChoices, avatarArtwork } from '#lib/avatars.ts';
  import { createParticipantSetup, type AvatarId, type ParticipantProfile } from '@lemmi/contracts';
  let {
    profile,
    close,
    saved,
    preview = false,
  }: {
    profile: ParticipantProfile;
    preview?: boolean;
    close: () => void;
    saved: (profile: ParticipantProfile) => void;
  } = $props();
  const setup = createParticipantSetup();
  let editing = $state(false);
  let name = $state('');
  let avatar = $state<AvatarId>('lemming');
  let busy = $state(false);
  let message = $state('');
  let contextEditing = $state(false);
  let details = $state<ProfileContextView | null>(null);
  let portrait = $state('');
  async function loadDetails() {
    if (preview) return;
    const result = await setup.context(profile.id);
    if (!result.ok) return;
    details = result.data;
    portrait = '';
    const photo = result.data.context.photos.find((photo) => photo.portrait);
    if (photo) {
      const image = await setup.image(profile.id, photo.assetId);
      if (image.ok) portrait = `data:image/png;base64,${image.data.dataBase64}`;
    }
  }
  function edit() {
    name = profile.preferredName;
    avatar = profile.avatarId;
    message = '';
    editing = true;
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !name.trim()) return;
    busy = true;
    if (preview) {
      try {
        const current = await clients.profile.loadCaregiver({ profileId: profile.id });
        if (!current.ok) {
          message = current.error.message;
          return;
        }
        if (current.data.revision !== profile.revision) {
          message = 'This profile changed elsewhere. Close and reopen it before saving.';
          return;
        }
        const result = await clients.profile.save({
          profile: { ...current.data, preferredName: name.trim(), avatarId: avatar },
          expectedRevision: profile.revision,
        });
        if (!result.ok) {
          message = result.error.message;
          return;
        }
        const { id, preferredName, avatarId, revision, communicationSupport } = result.data;
        saved({ id, preferredName, avatarId, revision, communicationSupport });
        editing = false;
        message = 'Saved to the local mock backend. Resets when that server restarts.';
      } catch {
        message = 'The local mock backend is unavailable. Your changes were not saved.';
      } finally {
        busy = false;
      }
      return;
    }
    const result = await setup.update({
      profileId: profile.id,
      expectedRevision: profile.revision,
      commandId: crypto.randomUUID(),
      patch: { preferredName: name.trim(), avatarId: avatar },
    });
    busy = false;
    if (result.ok) {
      saved(result.data);
      editing = false;
      message = 'Profile saved. An active conversation is paused; resume when ready.';
    } else
      message =
        result.error.message +
        ' Your edits are still here. Reopen the profile to refresh if it changed elsewhere.';
  }
  let dialog = $state<HTMLDialogElement>(null!);
  onMount(() => {
    dialog.showModal();
    void loadDetails();
  });
</script>

<dialog bind:this={dialog} class="profile-dialog" onclose={close} aria-labelledby="profile-title">
  <div class="profile-panel-top">
    <button class="profile-back-button" onclick={() => dialog.close()}
      ><span aria-hidden="true">←</span> Back to profiles</button
    >
    <div class="controls">
      <button
        class="quiet"
        disabled={editing || busy}
        onclick={() => (preview ? edit() : (contextEditing = true))}>Edit profile</button
      >
      <button class="quiet" aria-label="Close profile" onclick={() => dialog.close()}>✕</button>
    </div>
  </div>
  <h1 id="profile-title">Profile</h1>
  {#if preview}<p class="helper">
      Main app UI · fictional data · saves use the local mock backend
    </p>{/if}
  <div class="profile-summary" style:background-color="#9eab93">
    <div class="portrait-edit-wrap">
      <div class="photo-circle">
        {#if portrait}<img
            src={portrait}
            alt={`${profile.preferredName}'s profile picture`}
          />{:else}<span aria-hidden="true">{profile.preferredName.slice(0, 2).toUpperCase()}</span
          >{/if}
      </div>
    </div>
    <h2>{profile.preferredName}</h2>
    <p class="helper">Fictional demo profile</p>
  </div>
  <form onsubmit={save}>
    {#if editing}<label for="live-profile-name">Name</label>
      <input
        id="live-profile-name"
        bind:value={name}
        maxlength="80"
        required
        disabled={busy}
      />{/if}
    <fieldset class="avatar-fieldset" disabled={!editing || busy}>
      <legend>Animal avatar</legend>
      <div class="avatar-options">
        {#each avatarChoices as animal}
          <label
            class="avatar-option"
            class:selected={(editing ? avatar : profile.avatarId) === animal}
          >
            <input
              type="radio"
              name="live-avatar"
              value={animal}
              checked={(editing ? avatar : profile.avatarId) === animal}
              onchange={() => (avatar = animal)}
            />
            <span class="avatar-thumbnail"><AvatarArt avatarId={animal} decorative /></span><span
              >{avatarArtwork[animal].label}</span
            >
            {#if (editing ? avatar : profile.avatarId) === animal}<span
                class="avatar-check"
                aria-hidden="true">✓</span
              >{/if}
          </label>
        {/each}
      </div>
    </fieldset>
    {#if editing}<div class="controls">
        <button type="submit" disabled={busy || !name.trim()}
          >{busy ? 'Saving…' : 'Save changes'}</button
        >
        <button
          type="button"
          class="secondary"
          disabled={busy}
          onclick={() => {
            editing = false;
            message = '';
          }}>Cancel</button
        >
      </div>{/if}
  </form>
  <p role="status" aria-live="polite">{message}</p>
  <p class="helper">
    Edit this fictional demo profile to add familiar details, pictures and optional conversation
    memory. These controls are for fictional testing data only.
  </p>
  <section class="profile-details">
    <h2>Basic information</h2>
    <dl>
      <dt>Name</dt>
      <dd>{profile.preferredName}</dd>
    </dl>
    <h3>Biography &amp; interests</h3>
    {#if details}<p>
        {details.context.biography || 'Add a little about their life with Edit profile.'}
      </p>
      {#if details.context.career}<p>Career: {details.context.career}</p>{/if}
      {#if details.context.activities.length}<p>
          Activities: {details.context.activities.join(', ')}
        </p>{/if}
      <p>
        {details.summaryMemoryEnabled
          ? 'Short conversation summary memory is enabled.'
          : 'Conversation summary memory is off.'}
      </p>
    {:else}<p>Private caregiver information is unavailable in this demo view.</p>{/if}
    <h3>Conversation support</h3>
    <p>{profile.communicationSupport.preset}</p>
    <a
      class="button-link"
      href={preview
        ? '/preview/application?screen=conversation'
        : `/participant/conversation?profile=${encodeURIComponent(profile.id)}`}
      >Open conversation</a
    >
  </section>
  <section class="conversation-summary" aria-labelledby="live-summary-title">
    <div class="summary-heading"><h2 id="live-summary-title">Conversation Summary</h2></div>
    <div class="summary-columns">
      <section class="summary-section">
        <h3>Reported Concerns</h3>
        <p>Concern reports are not connected yet.</p>
      </section>
      <section class="summary-section">
        <h3>Conversation Highlights</h3>
        {#if details?.memories.length}{#each details.memories as memory}<p>
              <strong>AI summary — not reviewed:</strong>
              {memory.summary}
            </p>{/each}{:else}<p>No saved conversation summaries.</p>{/if}
      </section>
    </div>
    <section class="interest-trends" aria-labelledby="live-trends-title">
      <h3 id="live-trends-title">Interest &amp; Hobby Trends</h3>
      <p>Topics mentioned over time</p>
      <div class="trends-empty">
        <svg viewBox="0 0 480 120" aria-hidden="true" focusable="false"
          ><path
            d="M18 8v96h444M18 24h444M18 50h444M18 76h444"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          /></svg
        >
        <div>
          <strong>No permitted trend data available</strong>
          <p>Topic history is not connected. No example summaries are presented as live records.</p>
        </div>
      </div>
    </section>
    <div class="excerpt-setting">
      <div>
        <h3 id="live-excerpt-label">Save conversation excerpts</h3>
        <p id="live-excerpt-description">Caregiver privacy settings are unavailable here.</p>
      </div>
      <span class="helper">Unavailable</span>
    </div>
  </section>
</dialog>
{#if contextEditing}<ProfileContextForm
    {profile}
    close={() => (contextEditing = false)}
    saved={(updated) => {
      profile = updated;
      saved(updated);
      contextEditing = false;
      void loadDetails();
    }}
  />{/if}
