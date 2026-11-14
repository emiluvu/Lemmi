<script lang="ts">
  import { onMount } from 'svelte';
  import CameraStatus from '#lib/features/CameraStatus.svelte';
  import { clients } from '#lib/clients.ts';
  import type { CheckInSnapshot } from '@lemmi/contracts';

  let checkIn = $state<CheckInSnapshot | null>(null);
  let message = $state('Loading camera status…');
  let busy = $state(false);

  async function load() {
    const result = await clients.checkIn.status({ profileId: 'profile-alex' });
    if (result.ok) {
      checkIn = result.data;
      message = '';
    } else message = `${result.error.code}: ${result.error.message}`;
  }

  async function request() {
    busy = true;
    message = '';
    try {
      const result = await clients.checkIn.request({
        profileId: 'profile-alex',
        deviceId: 'fake-stackchan',
        commandId: crypto.randomUUID(),
      });
      if (result.ok) checkIn = result.data;
      else message = `${result.error.code}: ${result.error.message}`;
    } finally {
      busy = false;
    }
  }

  async function end() {
    if (!checkIn) return;
    busy = true;
    message = '';
    try {
      const result = await clients.checkIn.end({
        checkInId: checkIn.checkInId,
        commandId: crypto.randomUUID(),
      });
      if (result.ok) checkIn = result.data;
      else message = `${result.error.code}: ${result.error.message}`;
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    void load();
  });
</script>

<svelte:head><title>Camera Check-In — Lemmi</title></svelte:head>

<div class="camera-page-heading">
  <div>
    <h1>Camera Check-In</h1>
  </div>
</div>
<p>
  Camera is off by default. A request requires local Allow on the paired robot; opening this page
  never starts capture. This mock has no image stream or recording.
</p>

<CameraStatus {checkIn} />

<div class="controls" aria-label="Camera check-in controls">
  <button onclick={request} disabled={busy || checkIn?.state === 'active'}>Request camera</button>
  <button class="secondary" onclick={end} disabled={busy || checkIn?.state !== 'active'}>
    End check-in
  </button>
  <button class="quiet" onclick={() => void load()} disabled={busy}>Refresh status</button>
</div>
<p class="helper">
  End check-in is not a substitute for the robot’s immediate local Stop camera control.
</p>
<p role="status" aria-live="polite">{busy ? 'Working…' : message}</p>
