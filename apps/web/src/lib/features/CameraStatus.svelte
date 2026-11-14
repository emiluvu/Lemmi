<script lang="ts">
  import type { CheckInSnapshot } from '@lemmi/contracts';

  let { checkIn, participant = false }: { checkIn: CheckInSnapshot | null; participant?: boolean } =
    $props();

  const stateCopy = {
    off: 'Camera off',
    requested: 'Camera request waiting for local Allow',
    starting: 'Camera is preparing',
    active: 'Camera on',
    ended: 'Camera check-in ended',
    unavailable: 'Camera unavailable',
  } as const;

  function detail(snapshot: CheckInSnapshot) {
    if (snapshot.reason === 'awaiting_allow')
      return 'Nothing is being captured. The participant can choose Allow camera or Not now on the robot.';
    if (snapshot.reason === 'unsupported')
      return 'This device has not reported a supported camera path.';
    if (snapshot.reason === 'disabled') return 'Camera check-ins are disabled by default.';
    if (snapshot.reason === 'declined') return 'The local camera request was declined.';
    if (snapshot.reason === 'timeout') return 'The local camera request expired.';
    if (snapshot.reason === 'stopped') return 'Camera was stopped locally.';
    if (snapshot.reason === 'disconnected') return 'The connection ended; no image is shown.';
    if (snapshot.reason === 'revoked') return 'Camera permission was revoked.';
    return snapshot.fresh
      ? 'Connection is fresh. This mock does not include a camera stream.'
      : 'No fresh image is available.';
  }
</script>

<section class:camera-active={checkIn?.state === 'active'} class="status-panel" aria-live="polite">
  <p class="eyebrow">Camera check-in</p>
  <h2>{checkIn ? stateCopy[checkIn.state] : 'Checking camera status'}</h2>
  {#if checkIn}
    <p>{detail(checkIn)}</p>
    {#if participant && checkIn.state === 'active'}
      <p class="notice">
        <strong>Camera on — {checkIn.viewerDisplayName}</strong>. Use Stop camera on the robot to
        end it.
      </p>
    {/if}
    {#if !participant && checkIn.state === 'active'}
      <p class="notice">
        {checkIn.fresh
          ? 'Fresh image status reported.'
          : 'Connection lost — viewer must remain blank.'}
      </p>
    {/if}
  {:else}
    <p>Loading the current camera state. No camera is opened by this page.</p>
  {/if}
</section>
