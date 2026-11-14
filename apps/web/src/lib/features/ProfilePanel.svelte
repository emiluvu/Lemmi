<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { clients } from '#lib/clients.ts';
  import ConversationSummary from '#lib/features/ConversationSummary.svelte';
  import AdditionalInformation from '#lib/features/AdditionalInformation.svelte';
  import AvatarArt from '#lib/features/AvatarArt.svelte';
  import { avatarChoices, avatarArtwork } from '#lib/avatars.ts';
  import { alexProfileDetail } from '#lib/alex-demo-profile.ts';
  import type { AvatarId, CaregiverProfile } from '@lemmi/contracts';
  let {
    close,
    saved,
    color,
    photo,
    background,
  }: {
    close: () => void;
    saved: (
      profile: CaregiverProfile,
      color: string,
      photo: File | null | undefined,
      background: File | null | undefined,
    ) => void;
    color: string;
    photo: string | null;
    background: string | null;
  } = $props();
  let draftColor = $state('#9eab93');
  let draftPhoto = $state<string | null>(null);
  let newPhoto = $state<File | null | undefined>(undefined);
  let photoUrl: string | null = null;
  let draftBackground = $state<string | null>(null);
  let newBackground = $state<File | null | undefined>(undefined);
  let backgroundUrl: string | null = null;
  function clearBackgroundUrl() {
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    backgroundUrl = null;
  }
  function chooseBackground(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      message = 'Choose a JPG, PNG, or WebP image smaller than 5 MB.';
      return;
    }
    clearBackgroundUrl();
    newBackground = file;
    backgroundUrl = URL.createObjectURL(file);
    draftBackground = backgroundUrl;
  }
  onDestroy(clearBackgroundUrl);
  const colors = [
    { name: 'Sage', value: '#9eab93' },
    { name: 'Olive', value: '#6f725b' },
    { name: 'Sand', value: '#e8dcc6' },
    { name: 'Terracotta', value: '#bd8069' },
  ];
  function clearPhotoUrl() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = null;
  }
  function choosePhoto(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      message = 'Choose a JPG, PNG, or WebP image smaller than 5 MB.';
      return;
    }
    clearPhotoUrl();
    newPhoto = file;
    photoUrl = URL.createObjectURL(file);
    draftPhoto = photoUrl;
  }
  onDestroy(clearPhotoUrl);
  let dialog: HTMLDialogElement;
  let profile = $state<CaregiverProfile | null>(null);
  let editing = $state(false);
  let name = $state('');
  let avatar = $state<AvatarId>('lemming');
  let biography = $state(alexProfileDetail.approvedFacts.map((fact) => fact.value).join('\n'));
  let biographyDraft = $state('');
  let busy = $state(false);
  let message = $state('Loading profile…');
  const avatars = avatarChoices.map((id) => ({ id, label: avatarArtwork[id].label }));
  function reset() {
    if (!profile) return;
    name = profile.preferredName;
    avatar = profile.avatarId;
    biographyDraft = biography;
    draftColor = color;
    clearPhotoUrl();
    draftPhoto = photo;
    newPhoto = undefined;
    clearBackgroundUrl();
    draftBackground = background;
    newBackground = undefined;
  }
  onMount(() => {
    dialog.showModal();
    void clients.profile.loadCaregiver({ profileId: 'profile-alex' }).then((result) => {
      if (result.ok) {
        profile = result.data;
        reset();
        message = '';
      } else message = `${result.error.code}: ${result.error.message}`;
    });
  });
  async function changeExcerptSetting(enabled: boolean): Promise<string | null> {
    if (!profile || busy || editing)
      return 'Finish editing the profile before changing this setting.';
    busy = true;
    try {
      const result = await clients.profile.save({
        profile: { ...profile, excerptSavingEnabled: enabled },
        expectedRevision: profile.revision,
      });
      if (!result.ok) return `${result.error.code}: ${result.error.message}. Setting unchanged.`;
      profile = result.data;
      return null;
    } finally {
      busy = false;
    }
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!profile || busy) return;
    busy = true;
    const result = await clients.profile.save({
      profile: { ...profile, preferredName: name.trim(), avatarId: avatar },
      expectedRevision: profile.revision,
    });
    busy = false;
    if (result.ok) {
      profile = result.data;
      biography = biographyDraft;
      editing = false;
      message =
        'Name and animal avatar saved to the mock profile. Appearance changes apply for this page visit; biography remains a temporary draft.';
      saved(result.data, draftColor, newPhoto, newBackground);
    } else
      message = `${result.error.code}: ${result.error.message}. Your edits are still here. Close and reopen to load the latest profile.`;
  }
</script>

<dialog bind:this={dialog} class="profile-dialog" onclose={close} aria-labelledby="profile-title">
  <div class="profile-panel-top">
    <button class="profile-back-button" onclick={() => dialog.close()}> ← Back to profiles </button>
    <div class="controls">
      <button
        class="edit-profile"
        aria-label="Edit profile"
        title="Edit profile"
        disabled={!profile || editing}
        onclick={() => {
          reset();
          editing = true;
          message = '';
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg
        >
      </button>
      <button class="quiet" aria-label="Close profile" onclick={() => dialog.close()}>✕</button>
    </div>
  </div>
  <h1 id="profile-title">Profile</h1>
  {#if profile}
    <div
      class="profile-summary"
      class:has-background={Boolean(editing ? draftBackground : background)}
      style:background-color={editing ? draftColor : color}
      style:background-image={(editing ? draftBackground : background)
        ? `url("${editing ? draftBackground : background}")`
        : 'none'}
      style:color={(editing ? draftColor : color) === '#6f725b' ? '#ffffff' : '#10214c'}
    >
      <div class="portrait-edit-wrap">
        <div class="photo-circle">
          {#if editing ? draftPhoto : photo}<img
              src={editing ? draftPhoto : photo}
              alt={`${profile.preferredName}’s profile`}
            />{:else}<span aria-hidden="true"
              >{profile.preferredName.slice(0, 2).toUpperCase()}</span
            >{/if}
        </div>
        {#if editing}<label class="portrait-edit-control" title="Change profile photo">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Change profile photo"
              onchange={choosePhoto}
              disabled={busy}
            />
            <span aria-hidden="true"
              ><svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg
              ></span
            >
          </label>{/if}
      </div>
      <h2>{profile.preferredName}</h2>
      <p class="helper">Caregiver-provided · fictional demo profile</p>
    </div>
    <form onsubmit={save}>
      {#if editing}
        <section class="appearance-editor">
          <h2>Profile appearance</h2>
          {#if draftPhoto}<button
              type="button"
              class="quiet"
              disabled={busy}
              onclick={() => {
                clearPhotoUrl();
                draftPhoto = null;
                newPhoto = null;
              }}>Remove photo</button
            >{/if}
          <fieldset class="color-fieldset" disabled={busy}>
            <legend>Background</legend>
            <div class="color-options">
              {#each colors as option}<label
                  class="color-option"
                  style:background={option.value}
                  style:color={option.value === '#6f725b' ? '#ffffff' : '#10214c'}
                  ><input
                    type="radio"
                    name="profile-color"
                    value={option.value}
                    checked={!draftBackground && draftColor === option.value}
                    onchange={() => {
                      draftColor = option.value;
                      clearBackgroundUrl();
                      draftBackground = null;
                      newBackground = null;
                    }}
                  />{option.name}</label
                >{/each}
              <label
                class="color-option background-upload-option"
                class:background-selected={Boolean(draftBackground)}
              >
                <span aria-hidden="true">↑</span><span>Upload<small>Drop an image</small></span
                ><input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Upload profile background"
                  onchange={chooseBackground}
                  disabled={busy}
                /></label
              >
            </div>
            {#if draftBackground}<button
                type="button"
                class="quiet"
                disabled={busy}
                onclick={() => {
                  clearBackgroundUrl();
                  draftBackground = null;
                  newBackground = null;
                }}>Remove background</button
              >{/if}
            <p class="helper background-file-hint">JPG, PNG, or WebP · Up to 5 MB</p>
            <p class="helper">
              Photo, background and color apply for this page visit only. They are not uploaded or
              saved permanently.
            </p>
          </fieldset>
        </section>
      {/if}
      <fieldset class="avatar-fieldset" disabled={!editing || busy}>
        <legend>Choose an animal avatar</legend>
        <div class="avatar-options">
          {#each avatars as animal}
            <label class="avatar-option" class:selected={avatar === animal.id}>
              <input type="radio" name="avatar" value={animal.id} bind:group={avatar} />
              <span class="avatar-thumbnail"><AvatarArt avatarId={animal.id} decorative /></span
              ><span>{animal.label}</span>
              {#if avatar === animal.id}<span class="avatar-check" aria-hidden="true">✓</span>{/if}
            </label>
          {/each}
        </div>
      </fieldset>
      <p class="helper">
        Apply profile changes to use this animal on the conversation screen. Robot display support
        is not yet verified.
      </p>
      <section class="profile-details">
        <h2>Basic information</h2>
        {#if editing}<label class="profile-input"
            >Name<input bind:value={name} required maxlength="80" disabled={busy} /></label
          >
        {:else}<dl>
            <dt>Name</dt>
            <dd>{profile.preferredName}</dd>
          </dl>{/if}
        <h3>Biography</h3>
        {#if editing}<label class="profile-input"
            >Biography draft<textarea
              bind:value={biographyDraft}
              maxlength="2000"
              rows="4"
              disabled={busy}
            ></textarea></label
          >
        {:else}<p>{biography || 'No biography added.'}</p>{/if}
        <p class="helper">
          Fictional Alex background from the supplied demo profile. Edits remain temporary drafts;
          this does not update the deployed biography.
        </p>
        <h3>Interests</h3>
        <p>Gardening, beaches, and general banking conversation.</p>
        <p class="helper">
          Cooking is avoided. Banking conversation must not request account details or offer
          financial advice. Remembering and excerpt saving remain off.
        </p>
      </section>
      <ConversationSummary
        profileId={profile.id}
        excerptSavingEnabled={profile.excerptSavingEnabled}
        {changeExcerptSetting}
        privacyDisabled={busy || editing}
      />
      <AdditionalInformation profileId={profile.id} />
      {#if editing}<div class="controls">
          <button type="submit" disabled={busy || !name.trim()}
            >{busy ? 'Saving…' : 'Apply profile changes'}</button
          ><button
            type="button"
            class="secondary"
            disabled={busy}
            onclick={() => {
              reset();
              editing = false;
            }}>Cancel</button
          >
        </div>{/if}
    </form>
    {#if editing}
      <section class="profile-delete">
        <h2>Delete profile</h2>
        <p>Profile deletion is not available yet. No profile or journal records will be removed.</p>
        <button type="button" class="danger-button" disabled>Delete profile — unavailable</button>
      </section>
    {/if}
  {/if}
  <p role="status">{message}</p>
</dialog>
