<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ProfilePanel from '#lib/features/ProfilePanel.svelte';
  import GamesCatalog from '#lib/features/GamesCatalog.svelte';
  import { avatarArtwork } from '#lib/avatars.ts';
  import { clients } from '#lib/clients.ts';
  import type { OperationOutput, CaregiverProfile } from '@lemmi/contracts';
  let overview = $state<OperationOutput<'overview.load'> | null>(null);
  let message = $state('Loading mock overview…');
  let search = $state('');
  let profileOpen = $state(false);
  let profileColor = $state('#9eab93');
  let profilePhoto = $state<string | null>(null);
  let profileBackground = $state<string | null>(null);
  const tabs = ['Profiles', 'Games', 'Ecosystem'] as const;
  let activeTab = $state<(typeof tabs)[number]>('Profiles');
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
  function applyProfile(
    profile: CaregiverProfile,
    color: string,
    photo: File | null | undefined,
    background: File | null | undefined,
  ) {
    if (overview) overview = { ...overview, profile };
    profileColor = color;
    if (photo !== undefined) {
      if (profilePhoto) URL.revokeObjectURL(profilePhoto);
      profilePhoto = photo ? URL.createObjectURL(photo) : null;
    }
    if (background !== undefined) {
      if (profileBackground) URL.revokeObjectURL(profileBackground);
      profileBackground = background ? URL.createObjectURL(background) : null;
    }
  }
  onDestroy(() => {
    if (profilePhoto) URL.revokeObjectURL(profilePhoto);
    if (profileBackground) URL.revokeObjectURL(profileBackground);
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
        <div>
          <button disabled title="Profile creation is not connected yet">+ Create profile</button>
        </div>
      </div>
      <div class="profile-grid">
        {#if overview.profile.preferredName.toLowerCase().includes(search.trim().toLowerCase())}
          <section class="profile-card functional-profile">
            <div
              class="profile-portrait"
              style:background-color={profileColor}
              style:background-image={profileBackground ? `url("${profileBackground}")` : 'none'}
            >
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
              <p><strong>Companion: {avatarArtwork[overview.profile.avatarId].label}</strong></p>
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
        <h3>Caregiver Setting</h3>
        <p>Review your caregiver photo and account options.</p>
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
    <GamesCatalog />
  </div>
</div>
{#if profileOpen}<ProfilePanel
    close={() => (profileOpen = false)}
    saved={applyProfile}
    color={profileColor}
    photo={profilePhoto}
    background={profileBackground}
  />{/if}
