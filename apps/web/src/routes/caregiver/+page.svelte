<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ProfilePanel from '#lib/features/ProfilePanel.svelte';
  import GamesCatalog from '#lib/features/GamesCatalog.svelte';
  import { avatarArtwork } from '#lib/avatars.ts';
  import { clients } from '#lib/clients.ts';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import UIIcon from '#lib/features/UIIcon.svelte';
  import AvatarArt from '#lib/features/AvatarArt.svelte';
  import {
    createParticipantSetup,
    type ParticipantProfile,
    type OperationOutput,
    type CaregiverProfile,
  } from '@lemmi/contracts';
  import { previewProfiles } from '@lemmi/contracts/fixtures';
  import LiveProfilePanel from '#lib/features/LiveProfilePanel.svelte';
  let { data } = $props();
  let overview = $state<OperationOutput<'overview.load'> | null>(null);
  const setup = createParticipantSetup();
  let liveProfiles = $state<ParticipantProfile[]>([]);
  let selectedProfile = $state<ParticipantProfile | null>(null);
  let creating = $state(false);
  let newName = $state('');
  let busy = $state(false);
  const displayedProfiles = $derived(data.live ? liveProfiles : overview ? [overview.profile] : []);
  const previews = $derived(data.live ? previewProfiles : (overview?.previews ?? []));
  async function createProfile(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !newName.trim()) return;
    busy = true;
    const result = await setup.create(newName.trim());
    busy = false;
    if (result.ok) {
      liveProfiles = [...liveProfiles, result.data];
      newName = '';
      creating = false;
      message = '';
    } else message = result.error.message;
  }
  let message = $state('Loading profiles…');
  let search = $state('');
  let profileOpen = $state(false);
  let profileColor = $state('#9eab93');
  let profilePhoto = $state<string | null>(null);
  let profileBackground = $state<string | null>(null);
  const tabs = ['Profiles', 'Games', 'Ecosystem'] as const;
  const activeTab = $derived(
    tabs.find((tab) => `#${tab.toLowerCase()}` === page.url.hash) ?? 'Profiles',
  );
  function selectTab(tab: (typeof tabs)[number]) {
    void goto(`#${tab.toLowerCase()}`, { reset: false });
  }
  function tabKey(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[next]);
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
    if (data.live) {
      if (!data.demoEnrollment) {
        message = 'Fictional demo setup is disabled.';
        return;
      }
      const result = await setup.profiles();
      if (result.ok) {
        liveProfiles = result.data;
        message = '';
      } else message = result.error.message;
      return;
    }
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
  <div>
    <p class="eyebrow">Your caregiver workspace</p>
    <h1>{activeTab === 'Profiles' ? 'Your profiles' : activeTab}</h1>
    <p class="dashboard-intro">
      {activeTab === 'Profiles'
        ? 'Choose a profile to view.'
        : activeTab === 'Games'
          ? 'Familiar activities, at your own pace.'
          : 'Your companion and connected setup.'}
    </p>
  </div>
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
        onclick={() => selectTab(tab)}
        onkeydown={(event) => tabKey(event, index)}
        ><UIIcon
          name={index === 0 ? 'profiles' : index === 1 ? 'music' : 'robot'}
          size={20}
        />{tab}</button
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
    {#if message}<p role="status">{message}</p>{/if}
    {#if overview || data.live}
      <div class="profile-tools">
        <label class="profile-search">
          <span class="sr-only">Search profiles</span>
          <input bind:value={search} type="search" placeholder="Search profiles" />
        </label>
        <div class="create-profile-control">
          <button
            disabled={!data.live || !data.demoEnrollment || busy}
            onclick={() => (creating = !creating)}
            aria-describedby="create-unavailable"
            ><span aria-hidden="true">＋</span> Create profile</button
          >
          <p id="create-unavailable" class="helper">
            {data.live
              ? 'Create a separate fictional demo profile.'
              : 'Profile creation is not available in the local mock.'}
          </p>
        </div>
      </div>
      {#if creating}<form class="card" onsubmit={createProfile}>
          <label for="new-profile-name">Fictional participant name</label>
          <input
            id="new-profile-name"
            bind:value={newName}
            maxlength="80"
            required
            autocomplete="off"
          />
          <button disabled={busy || !newName.trim()}>Create fictional profile</button>
          <button type="button" class="quiet" onclick={() => (creating = false)}>Cancel</button>
        </form>{/if}
      <p class="profile-scope">
        {data.live
          ? 'Live fictional profiles. Journals, camera and games remain unavailable or labeled previews.'
          : 'Alex is the functional fictional demo. Other cards are previews only.'}
      </p>
      <div class="profile-grid">
        {#each displayedProfiles.filter((profile) => profile.preferredName
            .toLowerCase()
            .includes(search.trim().toLowerCase())) as profile (profile.id)}
          <section class="profile-card functional-profile">
            <div
              class="profile-portrait"
              class:has-background={Boolean(profileBackground)}
              style:background-color={profileColor}
              style:background-image={profileBackground ? `url("${profileBackground}")` : undefined}
            >
              <span class="portrait-caption">Your companion profile</span>
              <div class="photo-circle">
                {#if profilePhoto}<img
                    src={profilePhoto}
                    alt={`${profile.preferredName}’s profile`}
                  />{:else}<span aria-hidden="true"
                    >{profile.preferredName.slice(0, 2).toUpperCase()}</span
                  >{/if}
              </div>
              <span class="portrait-companion"
                ><AvatarArt avatarId={profile.avatarId} decorative /></span
              >
            </div>
            <div class="profile-card-body">
              <h2>{profile.preferredName}</h2>
              <p class="profile-kind">Fictional demo profile</p>
              <p class="companion-label">
                <span class="companion-dot" aria-hidden="true"></span>{avatarArtwork[
                  profile.avatarId
                ].label} companion
              </p>
              <button
                class="profile-open"
                onclick={() => {
                  if (data.live) selectedProfile = profile;
                  else profileOpen = true;
                }}>View profile <UIIcon name="arrow" size={19} /></button
              >
              <div class="profile-actions">
                <a
                  class="profile-action-button"
                  href={data.live
                    ? `/participant/conversation?profile=${encodeURIComponent(profile.id)}`
                    : '/participant/conversation'}><UIIcon name="leaf" size={18} /> Conversation</a
                >
                <a class="profile-action-button" href="/caregiver/check-in"
                  ><UIIcon name="camera" size={18} /> Camera</a
                >
              </div>
            </div>
          </section>
        {/each}
        {#each previews.filter((preview) => preview.preferredName
            .toLowerCase()
            .includes(search.trim().toLowerCase())) as preview (preview.id)}
          <section class="profile-card preview-profile">
            <div class="profile-portrait">
              <span class="portrait-caption">A little room for someone new</span>
              <div class="photo-circle">
                <span aria-hidden="true">{preview.preferredName.slice(0, 2).toUpperCase()}</span>
              </div>
            </div>
            <div class="profile-card-body">
              <h2>{preview.preferredName}</h2>
              <p class="preview-label">{preview.label}</p>
              <p class="helper">A static example of the profile layout.</p>
              <span class="profile-inert">No live session</span>
            </div>
          </section>
        {/each}
        {#if ![...displayedProfiles, ...previews].some((profile) => profile.preferredName
            .toLowerCase()
            .includes(search.trim().toLowerCase()))}<p class="empty-state">
            No profiles match your search.
          </p>{/if}
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
        <span class="section-icon"><UIIcon name="robot" size={30} /></span>
        <h3>Stackchan</h3>
        <p>
          Each enrolled robot has its own identity. Open Conversation to connect a browser;
          switching audio endpoints requires an explicit handoff.
        </p>
      </section>
      <section class="card">
        <span class="section-icon"><UIIcon name="camera" size={30} /></span>
        <h3>Camera check-ins</h3>
        <p>Camera is off by default. Each request needs local approval.</p>
        <a href="/caregiver/check-in">Camera settings →</a>
      </section>
      <section class="card">
        <span class="section-icon"><UIIcon name="settings" size={30} /></span>
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

{#if selectedProfile}<LiveProfilePanel
    profile={selectedProfile}
    close={() => (selectedProfile = null)}
  />{/if}
