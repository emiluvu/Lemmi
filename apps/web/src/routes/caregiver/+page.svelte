<script lang="ts">
  import { onMount } from 'svelte';
  import { clients } from '#lib/clients.ts';
  import type { OperationOutput } from '@lemmi/contracts';
  let overview = $state<OperationOutput<'overview.load'> | null>(null);
  let message = $state('Loading mock overview…');
  let journal = $state<OperationOutput<'journal.load'> | null>(null);
  async function load() {
    const result = await clients.overview.load({ profileId: 'profile-alex' });
    if (result.ok) {
      overview = result.data;
      message = '';
    } else message = result.error.message;
    const records = await clients.journal.load({ profileId: 'profile-alex' });
    if (records.ok) journal = records.data;
  }
  onMount(() => {
    void load();
  });
</script>

<h1>Caregiver dashboard example</h1>
<p>
  This local mock page has no caregiver authentication. Do not enter private information or expose
  it publicly.
</p>
<p role="status">{message}</p>
{#if overview}<div class="cards">
    <section class="card">
      <p class="tag">Functional demo profile</p>
      <h2>{overview.profile.preferredName}</h2>
      <p>Companion: {overview.profile.avatarId}</p>
      <p>Devices and real contact routing: not configured</p>
      <a href="/participant">Open participant demo</a>
    </section>
    {#each overview.previews as profile}<section class="card">
        <p class="tag">{profile.label}</p>
        <h2>{profile.preferredName}</h2>
        <p>Static illustration only. No live session, journal, contact or camera controls.</p>
      </section>{/each}
  </div>{/if}
<section class="card">
  <h2>Factual mock journal</h2>
  <p>In-memory events only. No excerpts or AI summary.</p>
  {#if journal?.sessions.length}{#each journal.sessions as record}<h3>{record.sessionId}</h3>
      <ul>
        {#each record.events as event}<li>{event.type} · {event.source}</li>{/each}
      </ul>{/each}{:else}<p>No mock sessions recorded.</p>{/if}<button onclick={load}
    >Refresh overview and journal</button
  >
</section>
