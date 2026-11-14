<script lang="ts">
  import { onDestroy } from 'svelte';
  let { label, initials }: { label: string; initials: string } = $props();
  let preview = $state<string | null>(null);
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
    if (preview) URL.revokeObjectURL(preview);
    preview = URL.createObjectURL(file);
    message = 'Temporary preview only. Photo saving is not connected yet.';
    input.value = '';
  }
  function remove() {
    if (preview) URL.revokeObjectURL(preview);
    preview = null;
    message = 'Preview removed.';
  }
  onDestroy(() => {
    if (preview) URL.revokeObjectURL(preview);
  });
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
