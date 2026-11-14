<script lang="ts">
  import { onMount } from 'svelte';
  import AvatarArt from './AvatarArt.svelte';
  import UIIcon from './UIIcon.svelte';
  import { avatarChoices, avatarArtwork } from '#lib/avatars.ts';
  import type { ParticipantProfile } from '@lemmi/contracts';
  let { profile, close }: { profile: ParticipantProfile; close: () => void } = $props();
  let dialog = $state<HTMLDialogElement>(null!);
  onMount(() => dialog.showModal());
</script>

<dialog bind:this={dialog} class="profile-dialog" onclose={close} aria-labelledby="profile-title">
  <div class="profile-panel-top">
    <button class="profile-back-button" onclick={() => dialog.close()}
      ><span aria-hidden="true">←</span> Back to profiles</button
    >
    <div class="controls">
      <button class="quiet" disabled title="Caregiver sign-in is required to edit profiles"
        >Edit profile</button
      >
      <button class="quiet" aria-label="Close profile" onclick={() => dialog.close()}>✕</button>
    </div>
  </div>
  <h1 id="profile-title">Profile</h1>
  <div class="profile-summary" style:background-color="#9eab93">
    <div class="portrait-edit-wrap">
      <div class="photo-circle">
        <span aria-hidden="true">{profile.preferredName.slice(0, 2).toUpperCase()}</span>
      </div>
    </div>
    <h2>{profile.preferredName}</h2>
    <p class="helper">Fictional demo profile</p>
  </div>
  <fieldset class="avatar-fieldset" disabled>
    <legend>Animal avatar</legend>
    <div class="avatar-options">
      {#each avatarChoices as animal}
        <label class="avatar-option" class:selected={profile.avatarId === animal}>
          <input
            type="radio"
            name="live-avatar"
            value={animal}
            checked={profile.avatarId === animal}
          />
          <span class="avatar-thumbnail"><AvatarArt avatarId={animal} decorative /></span><span
            >{avatarArtwork[animal].label}</span
          >
          {#if profile.avatarId === animal}<span class="avatar-check" aria-hidden="true">✓</span
            >{/if}
        </label>
      {/each}
    </div>
  </fieldset>
  <p class="helper">
    Private profile editing requires caregiver sign-in, which is not connected to this browser yet.
  </p>
  <section class="profile-details">
    <h2>Basic information</h2>
    <dl>
      <dt>Name</dt>
      <dd>{profile.preferredName}</dd>
    </dl>
    <h3>Biography &amp; interests</h3>
    <p>Private caregiver information is unavailable in this demo view.</p>
    <h3>Conversation support</h3>
    <p>{profile.communicationSupport.preset}</p>
    <a
      class="button-link"
      href={`/participant/conversation?profile=${encodeURIComponent(profile.id)}`}
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
        <p>Journal review is not connected yet.</p>
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
