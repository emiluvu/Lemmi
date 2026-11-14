<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import { photoStoryPreviewKey, type PhotoStoryPreviewContext } from '#lib/photo-story-preview.ts';
  let { profileId }: { profileId: string } = $props();
  const album = getContext<PhotoStoryPreviewContext>(photoStoryPreviewKey);
  let candidate = $state<File | null>(null);
  let candidateUrl = $state<string | null>(null);
  let caption = $state('');
  let message = $state('');
  let imageReady = $state(false);
  const approvedPhotos = $derived(album.photos.filter((photo) => photo.profileId === profileId));
  function clearCandidate() {
    if (candidateUrl) URL.revokeObjectURL(candidateUrl);
    candidateUrl = null;
    candidate = null;
    caption = '';
    imageReady = false;
  }
  function selectFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      message = 'Choose a PNG, JPG, or WebP image up to 5 MB.';
      return;
    }
    clearCandidate();
    candidate = file;
    candidateUrl = URL.createObjectURL(file);
    message = '';
  }
  function approve() {
    if (!candidate || !imageReady) return;
    const error = album.add(profileId, candidate, caption);
    if (error) {
      message = error;
      return;
    }
    clearCandidate();
    message = 'Picture added to this profile’s Photo story preview.';
  }
  onDestroy(clearCandidate);
</script>

<section class="story-file-picker" aria-labelledby="story-files-title">
  <h3 id="story-files-title">Photo story pictures</h3>
  <p>Choose a picture, review it, and approve it for the participant’s Photo story preview.</p>
  <label class="information-file-picker"
    >Choose an image<input
      type="file"
      accept="image/png,image/jpeg,image/webp"
      onchange={selectFile}
      aria-label="Choose a Photo story image"
    /></label
  >
  <p class="helper">PNG, JPG, WebP · Up to 5 MB · Five pictures maximum</p>
  {#if candidateUrl}<div class="photo-approval">
      <img
        src={candidateUrl}
        alt="Awaiting caregiver approval"
        onload={() => (imageReady = true)}
        onerror={() => {
          imageReady = false;
          message = 'This image cannot be displayed. Choose another file.';
        }}
      />
      <label class="profile-input"
        >Caption (optional)<input
          bind:value={caption}
          maxlength="300"
          placeholder="Describe only what is approved to share"
        /></label
      >
      <div class="controls">
        <button type="button" onclick={approve} disabled={!imageReady}
          >Approve for Photo story preview</button
        ><button type="button" class="secondary" onclick={clearCandidate}>Cancel</button>
      </div>
    </div>{/if}
  {#if approvedPhotos.length}<ul class="approved-story-photos">
      {#each approvedPhotos as photo}<li>
          <img src={photo.url} alt={photo.caption || 'Approved preview picture'} />
          <div>
            <strong>{photo.caption || 'Picture without a caption'}</strong>
            <p>Approved for this profile’s preview</p>
          </div>
          <button type="button" class="quiet" onclick={() => album.remove(profileId, photo.id)}
            >Remove picture<span class="sr-only">: {photo.caption || 'uncaptioned picture'}</span
            ></button
          >
        </li>{/each}
    </ul>{:else}<p>No pictures approved yet.</p>{/if}
  <p class="helper">
    Pictures stay in this browser tab while you move between the profile and Conversation. Reloading
    clears them. They are not uploaded, sent to AI, or saved to the profile on the server.
  </p>
  <p role="status">{message}</p>
</section>

<style>
  .story-file-picker {
    margin: 24px 0;
    padding: 20px;
    border: 1px solid #c5d2b8;
    border-radius: 14px;
    background: #f4f7ef;
  }
  h3 {
    margin-top: 0;
  }
  .photo-approval {
    display: grid;
    gap: 16px;
    margin-top: 20px;
  }
  .photo-approval > img {
    width: 100%;
    height: 240px;
    object-fit: contain;
    background: #fffdf7;
    border-radius: 12px;
  }
  .approved-story-photos {
    padding: 0;
    list-style: none;
  }
  .approved-story-photos li {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    border-top: 1px solid #c5d2b8;
    padding: 16px 0;
  }
  .approved-story-photos img {
    width: 80px;
    height: 65px;
    object-fit: contain;
    border-radius: 8px;
    background: white;
  }
  .approved-story-photos p {
    font-size: 15px;
    margin: 0;
  }
</style>
