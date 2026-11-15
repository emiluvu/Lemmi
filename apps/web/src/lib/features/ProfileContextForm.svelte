<script lang="ts">
  import { onMount } from 'svelte';
  import {
    createParticipantSetup,
    ProfileContextSchema,
    type ParticipantProfile,
    type ProfileContextView,
    type ProfileContext,
  } from '@lemmi/contracts';
  import { avatarChoices } from '#lib/avatars.ts';
  import AvatarArt from './AvatarArt.svelte';
  import { plainPngBase64 } from '#lib/profile-images.ts';
  let {
    profile = null,
    saved,
    close,
    preview = false,
  }: {
    profile?: ParticipantProfile | null;
    saved: (profile: ParticipantProfile) => void;
    close: () => void;
    preview?: boolean;
  } = $props();
  const setup = createParticipantSetup();
  let dialog = $state<HTMLDialogElement>(null!);
  let context = $state<ProfileContext>(ProfileContextSchema.parse({}));
  let name = $state('');
  let avatar = $state<ParticipantProfile['avatarId']>('lemming');
  let support = $state<ParticipantProfile['communicationSupport']['preset']>('guided');
  let enabled = $state(false);
  let view = $state<ProfileContextView | null>(null);
  let activeId = $state('');
  let revision = $state(0);
  let busy = $state(false),
    loading = $state(true),
    message = $state('');
  let loadFailed = $state(false);
  let previews = $state<Record<string, string>>({});
  let files = $state<
    Array<{
      dataBase64: string;
      description: string;
      portrait: boolean;
      commandId: string;
      assetId?: string;
    }>
  >([]);
  const favouriteFields = [
    ['color', 'Colour'],
    ['animal', 'Animal'],
    ['season', 'Season'],
    ['flower', 'Flower'],
    ['meal', 'Meal'],
    ['foodDrink', 'Food or drink'],
    ['holiday', 'Holiday / celebrations'],
    ['restaurant', 'Restaurant'],
  ] as const;
  function apply(value: ProfileContextView) {
    view = value;
    activeId = value.profileId;
    revision = value.revision;
    name = value.preferredName;
    avatar = value.avatarId;
    context = structuredClone(value.context);
    enabled = value.summaryMemoryEnabled;
    support = value.communicationSupport.preset;
  }
  onMount(() => {
    name = profile?.preferredName ?? '';
    avatar = profile?.avatarId ?? 'lemming';
    activeId = profile?.id ?? '';
    revision = profile?.revision ?? 0;
    dialog.showModal();
    let disposed = false;
    if (profile && !preview)
      void (async () => {
        const result = await setup.context(profile.id);
        if (disposed) return;
        if (!result.ok) {
          message = result.error.message + ' Close and reopen to retry.';
          loadFailed = true;
          loading = false;
          return;
        }
        apply(result.data);
        loading = false;
        for (const photo of result.data.context.photos) {
          const image = await setup.image(profile.id, photo.assetId);
          if (!disposed && image.ok)
            previews = {
              ...previews,
              [photo.assetId]: `data:image/png;base64,${image.data.dataBase64}`,
            };
        }
      })();
    else loading = false;
    return () => {
      disposed = true;
      previews = {};
      files = [];
    };
  });
  async function chooseImages(event: Event, portrait: boolean) {
    if (busy) return;
    busy = true;
    const input = event.currentTarget as HTMLInputElement;
    const chosen = Array.from(input.files ?? []);
    input.value = '';
    message = '';
    for (const file of chosen) {
      if (context.photos.length + files.length >= 5) {
        message = 'Up to five pictures, including the profile picture.';
        break;
      }
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 8 * 1024 * 1024
      ) {
        message = 'Choose PNG, JPG or WebP pictures smaller than 8 MB.';
        continue;
      }
      try {
        const image = await createImageBitmap(file);
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
        image.close();
        const data = plainPngBase64(canvas.toDataURL('image/png').split(',')[1]!);
        canvas.width = canvas.height = 0;
        if (data.length > 1400000) {
          message = 'This picture is too large after resizing. Choose a smaller image.';
          continue;
        }
        if (portrait) {
          context.photos = context.photos.map((photo) => ({ ...photo, portrait: false }));
          files = files.map((photo) => ({ ...photo, portrait: false }));
        }
        files = [
          ...files,
          { dataBase64: data, description: '', portrait, commandId: crypto.randomUUID() },
        ];
      } catch {
        message = 'This picture could not be opened.';
      }
    }
    busy = false;
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy || loading || loadFailed || !name.trim()) return;
    message = '';
    busy = true;
    try {
      const checked = ProfileContextSchema.parse({
        ...context,
        importantPeople: context.importantPeople.filter((person) => person.name.trim()),
        activities: context.activities.filter((value) => value.trim()),
        comfortableTopics: context.comfortableTopics.filter((value) => value.trim()),
        avoidTopics: context.avoidTopics.filter((value) => value.trim()),
      });
      if (preview) {
        message = 'Preview only — this form does not save or send pictures.';
        return;
      }
      if (!activeId) {
        const created = await setup.create(name.trim(), avatar, {
          context: checked,
          summaryMemoryEnabled: enabled,
        });
        if (!created.ok) {
          message = created.error.message;
          return;
        }
        activeId = created.data.id;
        revision = created.data.revision;
      }
      const photos = [...checked.photos];
      for (const file of files) {
        if (!file.assetId) {
          const upload = await setup.uploadImage({
            profileId: activeId,
            expectedRevision: revision,
            commandId: file.commandId,
            dataBase64: file.dataBase64,
            description: file.description,
          });
          if (!upload.ok) {
            message = 'Profile exists, but this picture was not saved: ' + upload.error.message;
            return;
          }
          file.assetId = upload.data.id;
        }
        photos.push({
          assetId: file.assetId,
          description: file.description,
          portrait: file.portrait,
        });
      }
      const result = await setup.saveContext({
        profileId: activeId,
        expectedRevision: revision,
        commandId: crypto.randomUUID(),
        preferredName: name.trim(),
        avatarId: avatar,
        communicationSupport: { preset: support, configVersion: 1 },
        context: { ...checked, photos },
        summaryMemoryEnabled: enabled,
      });
      if (!result.ok) {
        message =
          result.error.message +
          ' Your draft is still here. Reopen to refresh if the profile changed.';
        return;
      }
      apply(result.data);
      files = [];
      saved({
        id: result.data.profileId,
        language: profile?.language ?? 'en',
        preferredName: result.data.preferredName,
        avatarId: result.data.avatarId,
        revision: result.data.revision,
        communicationSupport: result.data.communicationSupport,
      });
      close();
    } catch {
      message = 'Could not save this profile. Check field lengths and try again.';
    } finally {
      busy = false;
    }
  }
  async function fill() {
    if (!activeId || preview || busy || loadFailed) return;
    if (
      !confirm(
        'Fill missing stored demo details with fictional examples? This reloads the form and replaces any unsaved draft.',
      )
    )
      return;
    busy = true;
    const result = await setup.fillDemo(activeId, revision, crypto.randomUUID());
    busy = false;
    if (result.ok) {
      apply(result.data);
      message =
        'Missing details filled with labelled fictional examples. Existing details and permissions were preserved.';
    } else message = result.error.message;
  }
  async function forget() {
    if (!activeId || preview || busy) return;
    if (
      !confirm(
        `Forget saved conversation summaries for ${name}? This also turns summary memory off.`,
      )
    )
      return;
    busy = true;
    const result = await setup.forget(activeId, revision, crypto.randomUUID());
    busy = false;
    if (result.ok) {
      apply(result.data);
      message = 'Saved conversation summaries forgotten. Memory is off.';
    } else message = result.error.message;
  }
</script>

<dialog
  bind:this={dialog}
  onclose={close}
  oncancel={(event) => {
    if (busy) event.preventDefault();
  }}
  aria-labelledby="context-title"
  class="context-dialog"
>
  <header>
    <div>
      <p class="eyebrow">Fictional demo · caregiver-provided details</p>
      <h1 id="context-title">{profile ? 'Edit profile' : 'Meet someone new'}</h1>
    </div>
    <button
      type="button"
      class="quiet"
      onclick={() => dialog.close()}
      aria-label="Close profile form"
      disabled={busy}>✕</button
    >
  </header>
  <p>
    Share what makes conversation familiar. Fields are optional except the name. Use fictional
    information in this demo.
  </p>
  {#if loading}<p role="status">Loading profile details…</p>{/if}
  <form onsubmit={submit}>
    <fieldset disabled={busy || loading}>
      <legend>About this person</legend>
      <label
        >Name they use<input bind:value={name} maxlength="80" required autocomplete="off" /></label
      >
      <div class="avatars" role="group" aria-label="Animal companion">
        {#each avatarChoices as animal}<label class:selected={avatar === animal}
            ><input
              type="radio"
              name="context-avatar"
              value={animal}
              bind:group={avatar}
            /><AvatarArt avatarId={animal} decorative /><span>{animal}</span></label
          >{/each}
      </div>
      <label
        >Conversation support<select aria-label="Conversation support" bind:value={support}
          ><option value="guided">Guided</option><option value="conversational"
            >Conversational</option
          ><option value="quiet">Quiet companionship</option></select
        ></label
      >
      <label>Career / previous work<input bind:value={context.career} maxlength="200" /></label>
      <label
        >A little about their life<textarea bind:value={context.biography} maxlength="1000" rows="3"
        ></textarea></label
      >
    </fieldset>
    <fieldset disabled={busy || loading}>
      <legend>Familiar people</legend>
      <p>
        No contact details are needed. A relationship entered here is context, not a notification
        recipient.
      </p>
      {#each context.importantPeople as person, index}<div class="person-row">
          <label>Name<input bind:value={person.name} maxlength="200" /></label><label
            >Relationship<input bind:value={person.relationship} maxlength="200" /></label
          ><button
            type="button"
            class="quiet"
            onclick={() =>
              (context.importantPeople = context.importantPeople.filter((_, i) => i !== index))}
            >Remove person</button
          >
        </div>{/each}
      <button
        type="button"
        class="secondary"
        disabled={context.importantPeople.length >= 8}
        onclick={() =>
          (context.importantPeople = [...context.importantPeople, { name: '', relationship: '' }])}
        >Add a person</button
      >
    </fieldset>
    <fieldset disabled={busy || loading}>
      <legend>Favourites &amp; everyday interests</legend>
      <label
        >Favourite activities (one per line)<textarea
          value={context.activities.join('\n')}
          oninput={(event) =>
            (context.activities = event.currentTarget.value.split('\n').slice(0, 8))}
          rows="3"
          maxlength="1000"
        ></textarea></label
      >
      <label>Pets<input bind:value={context.pets} maxlength="200" /></label>
      <div class="field-grid">
        {#each favouriteFields as [key, label]}<label
            >Favourite {label.toLowerCase()}<input
              bind:value={context.favourites[key]}
              maxlength="200"
            /></label
          >{/each}
      </div>
    </fieldset>
    <fieldset disabled={busy || loading}>
      <legend>Conversation comfort</legend>
      <label
        >Comfortable subjects (one per line, up to 80 characters each)<textarea
          value={context.comfortableTopics.join('\n')}
          oninput={(event) =>
            (context.comfortableTopics = event.currentTarget.value.split('\n').slice(0, 12))}
          rows="3"
          maxlength="960"
        ></textarea></label
      >
      <label
        >Subjects to gently move away from (one per line, up to 80 characters each)<textarea
          value={context.avoidTopics.join('\n')}
          oninput={(event) =>
            (context.avoidTopics = event.currentTarget.value.split('\n').slice(0, 12))}
          rows="3"
          maxlength="960"
        ></textarea></label
      >
      <p>
        These are optional suggestions. Current participant choices and requests for help take
        priority.
      </p>
    </fieldset>
    <fieldset disabled={busy || loading}>
      <legend>Pictures</legend>
      <p>
        Optional profile picture and up to four more photos. Descriptions help Lemmi talk about a
        picture; it does not identify people or analyse image contents.
      </p>
      <label
        >Profile picture<input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onchange={(event) => chooseImages(event, true)}
        /></label
      >
      <label
        >More pictures<input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onchange={(event) => chooseImages(event, false)}
        /></label
      >
      <div class="photos">
        {#each context.photos as photo, index}<div>
            {#if previews[photo.assetId]}<img
                src={previews[photo.assetId]}
                alt={photo.description ||
                  (photo.portrait ? 'Profile picture' : 'Approved profile picture')}
              />{/if}
            <p>{photo.portrait ? 'Profile picture' : 'Conversation picture'}</p>
            <label
              >Optional description<textarea bind:value={photo.description} maxlength="300" rows="2"
              ></textarea></label
            ><button
              type="button"
              class="quiet"
              onclick={() => (context.photos = context.photos.filter((_, i) => i !== index))}
              >Remove from profile</button
            >
          </div>{/each}
        {#each files as file, index}<div>
            <img src={`data:image/png;base64,${file.dataBase64}`} alt="New upload preview" />
            <p>{file.portrait ? 'Profile picture' : 'New conversation picture'}</p>
            <label
              >Optional description<textarea bind:value={file.description} maxlength="300" rows="2"
              ></textarea></label
            ><button
              type="button"
              class="quiet"
              onclick={() => (files = files.filter((_, i) => i !== index))}>Remove picture</button
            >
          </div>{/each}
      </div>
    </fieldset>
    <fieldset disabled={busy || loading}>
      <legend>Remembering conversations</legend>
      <label class="memory-choice"
        ><input type="checkbox" bind:checked={enabled} />Save short conversation summaries for
        future chats</label
      >
      <p>
        Off by default. When enabled, Lemmi may save up to ten short AI-generated summaries and use
        recent ones in future conversations. These may contain personal things discussed and may be
        wrong. No audio or full transcripts are saved. This is separate from approved profile facts
        and journal excerpts. Turning it off or forgetting clears saved summaries and pauses active
        conversation.
      </p>
      {#if view?.memories.length}<details>
          <summary>Saved summaries ({view.memories.length})</summary
          >{#each view.memories as memory}<article>
              <p class="eyebrow">
                AI summary · not reviewed · {new Date(memory.updatedAt).toLocaleDateString()}
              </p>
              <p>{memory.summary}</p>
            </article>{/each}
        </details>{/if}
      {#if activeId}<button type="button" class="secondary" onclick={forget}
          >Forget saved conversations</button
        >{/if}
    </fieldset>
    <p role="status" aria-live="polite">{busy ? 'Saving…' : message}</p>
    <footer>
      {#if activeId}<button
          type="button"
          class="quiet"
          onclick={fill}
          disabled={busy || loading || loadFailed || preview}>Fill missing demo details</button
        >{/if}<button type="button" class="secondary" onclick={() => dialog.close()} disabled={busy}
        >Cancel</button
      ><button type="submit" disabled={busy || loading || loadFailed || !name.trim()}
        >{profile ? 'Save profile' : 'Create profile'}</button
      >
    </footer>
  </form>
</dialog>

<style>
  .context-dialog {
    width: min(850px, calc(100% - 24px));
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: clamp(16px, 4vw, 32px);
    border: 1px solid #bdc8aa;
    border-radius: 28px;
    background: #fffdf7;
    color: #22331f;
  }
  .context-dialog::backdrop {
    background: #24331f80;
    backdrop-filter: blur(4px);
  }
  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  h1 {
    font-size: 30px;
    margin: 4px 0;
  }
  fieldset {
    margin: 24px 0;
    padding: 20px;
    border: 1px solid #cbd3bf;
    border-radius: 20px;
    min-width: 0;
  }
  legend {
    font-size: 22px;
    font-weight: 800;
    padding: 0 8px;
  }
  label {
    display: grid;
    gap: 8px;
    margin: 12px 0;
    font-weight: 700;
  }
  input:not([type='radio']):not([type='checkbox']),
  textarea,
  select {
    width: 100%;
    min-height: 48px;
    box-sizing: border-box;
    font: inherit;
    padding: 10px;
    border: 1px solid #829271;
    border-radius: 10px;
    background: white;
    color: #22331f;
  }
  textarea {
    resize: vertical;
  }
  p {
    line-height: 1.55;
  }
  button {
    min-height: 48px;
  }
  footer {
    position: sticky;
    bottom: 0;
    background: #fffdf7f5;
    border-top: 1px solid #d3dcc8;
    padding-top: 16px;
  }
  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }
  .person-row {
    display: flex;
    gap: 12px;
    align-items: end;
  }
  .person-row label {
    flex: 1;
    min-width: 0;
  }
  .avatars {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }
  .avatars label {
    padding: 8px;
    border: 2px solid transparent;
    border-radius: 16px;
    place-items: center;
  }
  .avatars :global(svg),
  .avatars :global(img) {
    max-height: 85px;
  }
  .avatars label.selected {
    border-color: #63774c;
    background: #eef3e6;
  }
  .photos {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .photos img {
    width: 100%;
    height: 160px;
    object-fit: contain;
    border-radius: 14px;
    background: #f0f3eb;
  }
  .memory-choice {
    display: flex;
    align-items: start;
    gap: 12px;
  }
  .memory-choice input {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }
  article {
    padding: 12px;
    border-bottom: 1px solid #ccd4c3;
  }
  @media (max-width: 600px) {
    .field-grid,
    .photos {
      grid-template-columns: 1fr;
    }
    .person-row {
      display: grid;
    }
    .avatars {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    fieldset {
      padding: 12px;
    }
    .context-dialog {
      border-radius: 18px;
    }
  }
</style>
