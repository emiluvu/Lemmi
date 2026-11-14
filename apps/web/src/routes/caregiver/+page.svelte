<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ProfilePanel from '#lib/features/ProfilePanel.svelte';
  import { avatarArtwork } from '#lib/avatars.ts';
  import { clients } from '#lib/clients.ts';
  import type { OperationOutput, CaregiverProfile } from '@lemmi/contracts';
  let overview = $state<OperationOutput<'overview.load'> | null>(null);
  let message = $state('Loading mock overview…');
  let search = $state('');
  let profileOpen = $state(false);
  let profileColor = $state('#9eab93');
  let profilePhoto = $state<string | null>(null);
  const tabs = ['Profiles', 'Games', 'Ecosystem'] as const;
  let activeTab = $state<(typeof tabs)[number]>('Profiles');
  let packs = $state<OperationOutput<'activities.list'> | null>(null);
  let catalogError = $state('');
  const activityNames = {
    music_playlist: 'Listen to music',
    twenty_questions: 'Let Lemmi guess',
    photo_album: 'Look through photos',
    object_matching: 'Match pictures',
  };
  function tabKey(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    activeTab = tabs[next];
    document.getElementById(`folder-tab-${next}`)?.focus();
  }
  function applyProfile(profile: CaregiverProfile, color: string, photo: File | null | undefined) {
    if (overview) overview = { ...overview, profile };
    profileColor = color;
    if (photo !== undefined) {
      if (profilePhoto) URL.revokeObjectURL(profilePhoto);
      profilePhoto = photo ? URL.createObjectURL(photo) : null;
    }
  }
  onDestroy(() => {
    if (profilePhoto) URL.revokeObjectURL(profilePhoto);
  });
  async function load() {
    const result = await clients.overview.load({ profileId: 'profile-alex' });
    if (result.ok) {
      overview = result.data;
      message = '';
    } else message = result.error.message;
  }
  onMount(() => {
    void load();
    void clients.activities.list({ profileId: 'profile-alex' }).then((result) => {
      if (result.ok) packs = result.data;
      else catalogError = result.error.message;
    });
  });
</script>

<div class="profiles-heading">
  <h1>{activeTab}</h1>
</div>
<div class="folder-workspace">
  <div class="folder-tabs" role="tablist" aria-label="Dashboard sections">
    {#each tabs as tab, index}
      <button
        type="button"
        role="tab"
        id={`folder-tab-${index}`}
        aria-selected={activeTab === tab}
        aria-controls={`folder-panel-${index}`}
        tabindex={activeTab === tab ? 0 : -1}
        onclick={() => (activeTab = tab)}
        onkeydown={(event) => tabKey(event, index)}>{tab}</button
      >
    {/each}
  </div>
  <div
    class="folder-panel"
    role="tabpanel"
    id="folder-panel-0"
    aria-labelledby="folder-tab-0"
    hidden={activeTab !== 'Profiles'}
    tabindex="0"
  >
    <p role="status">{message}</p>
    {#if overview}
      <div class="profile-tools">
        <label>
          <span class="sr-only">Search profiles</span>
          <input bind:value={search} type="search" placeholder="Search profiles" />
        </label>
        <p>One functional fictional profile: {overview.profile.preferredName}.</p>
        <div>
          <button disabled aria-describedby="create-unavailable">+ Create profile</button>
          <p id="create-unavailable" class="helper">Profile creation is not available yet.</p>
        </div>
      </div>
      <div class="profile-grid">
        {#if overview.profile.preferredName.toLowerCase().includes(search.trim().toLowerCase())}
          <section class="profile-card functional-profile">
            <div class="profile-portrait" style:background={profileColor}>
              <div class="photo-circle">
                {#if profilePhoto}<img
                    src={profilePhoto}
                    alt={`${overview.profile.preferredName}’s profile`}
                  />{:else}<span aria-hidden="true"
                    >{overview.profile.preferredName.slice(0, 2).toUpperCase()}</span
                  >{/if}
              </div>
            </div>
            <div class="profile-card-body">
              <h2>{overview.profile.preferredName}</h2>
              <button class="profile-open" onclick={() => (profileOpen = true)}
                >View profile <span aria-hidden="true">→</span></button
              >
              <p>Companion: {avatarArtwork[overview.profile.avatarId].label}</p>
              <div class="profile-actions">
                <a class="profile-action-button" href="/participant/conversation">Conversation</a>
                <a class="profile-action-button" href="/caregiver/check-in">Camera</a>
              </div>
            </div>
          </section>
        {:else}<p>No profiles match your search.</p>{/if}
      </div>
    {:else}
      <section class="card"><p>Loading the fictional profile list…</p></section>
    {/if}
  </div>
  <div
    class="folder-panel"
    role="tabpanel"
    id="folder-panel-2"
    aria-labelledby="folder-tab-2"
    hidden={activeTab !== 'Ecosystem'}
    tabindex="0"
  >
    <p class="eyebrow">Your connected setup</p>
    <h2>Lemmi ecosystem</h2>
    <p>Manage the companion and its caregiver settings in one place.</p>
    <div class="cards">
      <section class="card">
        <h3>Stackchan</h3>
        <p>Device pairing and live connection status are not configured yet.</p>
      </section>
      <section class="card">
        <h3>Camera check-ins</h3>
        <p>Camera is off by default. Each request needs local approval.</p>
        <a href="/caregiver/check-in">Camera settings →</a>
      </section>
      <section class="card">
        <h3>Profile settings</h3>
        <p>Review appearance and account options.</p>
        <a href="/caregiver/settings">Open settings →</a>
      </section>
    </div>
  </div>
  <div
    class="folder-panel"
    role="tabpanel"
    id="folder-panel-1"
    aria-labelledby="folder-tab-1"
    hidden={activeTab !== 'Games'}
    tabindex="0"
  >
    <p class="eyebrow">Activities at your pace</p>
    <h2>Games & activities</h2>
    <p>Choose reviewed activities through the participant view.</p>
    {#if catalogError}<p role="status">{catalogError}</p>{:else if packs}<div class="cards">
        {#each packs as pack}<section class="card">
            <h3>{activityNames[pack.activityId]}</h3>
            <p>
              {pack.implemented
                ? 'Mock activity available. Media playback is not connected.'
                : 'Not available yet.'}
            </p>
            {#if pack.implemented}<a href="/participant">Open participant view →</a>{/if}
          </section>{/each}
      </div>{:else}<p>Loading activities…</p>{/if}
  </div>
</div>
{#if profileOpen}<ProfilePanel
    close={() => (profileOpen = false)}
    saved={applyProfile}
    color={profileColor}
    photo={profilePhoto}
  />{/if}
