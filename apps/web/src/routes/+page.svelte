<script lang="ts">
  import BrandLogo from '#lib/features/BrandLogo.svelte';
</script>

<div class="welcome-brand">
  <BrandLogo size={88} />
  <div>
    <p class="eyebrow">A little company. A familiar rhythm.</p>
    <h1>Welcome to Lemmi</h1>
  </div>
</div>
<p>
  The team’s contracts, clients and mock gateway are wired together. This is a development shell,
  with one fictional functional profile.
</p>
<div class="cards">
  <a class="card" href="/participant"
    ><h2>Participant</h2>
    <p>Start Alex’s mock session and exercise music and local-control commands.</p></a
  ><a class="card" href="/caregiver"
    ><h2>Caregiver demo</h2>
    <p>Inspect the fictional overview and preview-only example cards.</p></a
  >
</div>
<p>
  Live authentication, speech, music assets, camera, notification delivery and persistence are
  pending. Restarting the gateway resets its in-memory state.
</p>

<style>
  .welcome-brand {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
  }
  .welcome-brand h1 {
    margin: 0;
  }
  .welcome-brand .eyebrow {
    margin: 0 0 8px;
  }
  @media (max-width: 480px) {
    .welcome-brand {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
