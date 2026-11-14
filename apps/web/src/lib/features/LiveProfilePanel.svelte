<script lang="ts">
  import { onMount } from 'svelte';
  import AvatarArt from './AvatarArt.svelte';
  import type { ParticipantProfile } from '@lemmi/contracts';
  let { profile, close }: { profile: ParticipantProfile; close: () => void } = $props();
  let dialog = $state<HTMLDialogElement>(null!);
  onMount(() => dialog.showModal());
</script>

<dialog bind:this={dialog} class="profile-dialog" onclose={close} aria-labelledby="profile-title">
  <div class="profile-panel-top">
    <button class="profile-back-button" onclick={() => dialog.close()}>← Back to profiles</button>
    <button class="quiet" aria-label="Close profile" onclick={() => dialog.close()}>✕</button>
  </div>
  <h1 id="profile-title">Profile</h1>
  <div class="profile-summary" style:background-color="#9eab93">
    <div class="photo-circle"><span>{profile.preferredName.slice(0, 2).toUpperCase()}</span></div>
    <div>
      <h2>{profile.preferredName}</h2>
      <p>Fictional demo profile</p>
    </div>
    <AvatarArt avatarId={profile.avatarId} decorative />
  </div>
  <section class="card">
    <h2>Companion</h2>
    <p>Conversation support: {profile.communicationSupport.preset}.</p>
    <a
      class="button-link"
      href={`/participant/conversation?profile=${encodeURIComponent(profile.id)}`}
    >
      Open conversation
    </a>
    <p class="helper">
      Private profile editing requires caregiver sign-in, which is not connected to this browser
      yet.
    </p>
  </section>
  <section class="conversation-summary">
    <h2>Conversation Summary</h2>
    <div class="summary-columns">
      <section class="summary-section">
        <h3>Reported Concerns</h3>
        <p>Concern reports are not available here yet.</p>
      </section>
      <section class="summary-section">
        <h3>Conversation Highlights</h3>
        <p>Journal review is not connected yet.</p>
      </section>
    </div>
    <p>No example summaries are presented as live conversation records.</p>
  </section>
</dialog>
