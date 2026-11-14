<script lang="ts">
  import { getContext } from 'svelte';
  import { caregiverAppearanceKey, type CaregiverAppearance } from '#lib/caregiver-appearance.ts';
  let { label, initials }: { label: string; initials: string } = $props();
  const appearance = getContext<CaregiverAppearance>(caregiverAppearanceKey);
  const preview = $derived(appearance.photo);
  let message = $state('');
  function change(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      message = 'Choose a JPG, PNG, or WebP image smaller than 5 MB.';
      input.value = '';
      return;
    }
    appearance.setPhoto(file);
    message = 'Temporary preview only. Photo saving is not connected yet.';
    input.value = '';
  }
  function remove() {
    appearance.setPhoto(null);
    message = 'Preview removed.';
  }
</script>

<div class="photo-picker">
  <div class="photo-circle">
    {#if preview}<img src={preview} alt={label} onerror={remove} />{:else}<span aria-hidden="true"
        >{initials}</span
      >{/if}
  </div>
  <label class="photo-upload">
    <span>Change photo<span class="sr-only">: {label}</span></span>
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label={`Change ${label}`}
      onchange={change}
    />
  </label>
  {#if preview}<button class="quiet photo-remove" onclick={remove}>Remove preview</button>{/if}
  <span class="photo-hint">Preview only · not saved</span>
  <span class="photo-hint" role="status">{message}</span>
</div>
