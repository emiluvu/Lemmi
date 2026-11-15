<script lang="ts">
  let {
    teaching = true,
    photos = true,
    voice = true,
    compact = false,
  }: { teaching?: boolean; photos?: boolean; voice?: boolean; compact?: boolean } = $props();
</script>

<section class="activity-phrases" class:compact aria-labelledby="activity-phrases-title">
  <h2 id="activity-phrases-title">{compact ? 'You can say' : 'What would you like to do?'}</h2>
  {#if !compact}<p>
      {voice
        ? 'When the microphone is listening, you can say:'
        : 'Voice is unavailable in this preview. In the connected app, you can say:'}
    </p>{/if}
  <ul>
    {#if teaching}<li>“Let’s play Teach Lemmi”</li>{/if}
    {#if photos}<li>“Start Photo Story”</li>
      <li>“Explore pictures”</li>{/if}
    <li>“Back to conversation”</li>
  </ul>
  {#if !teaching && !photos}<p>These activities are unavailable on this connection.</p>{/if}
  <p class="helper">
    {compact
      ? 'Other games are not available yet.'
      : 'Music, 20 Questions and picture matching are not available to play on this server yet.'}
  </p>
</section>

<style>
  .activity-phrases {
    margin: 24px auto;
    max-width: 42ch;
    text-align: left;
  }
  h2 {
    font-size: 26px;
    margin: 0 0 12px;
  }
  ul {
    display: block;
    padding-left: 28px;
    margin: 16px 0;
    list-style: disc;
  }
  li {
    margin: 12px 0;
    font-size: 23px;
    font-weight: 650;
  }
  .helper {
    font-size: 16px;
    line-height: 1.5;
  }
  .compact {
    margin: 0;
  }
  .compact h2 {
    font-size: clamp(21px, 2.5vw, 26px);
    margin-bottom: 8px;
  }
  .compact p {
    margin: 6px 0;
    font-size: 16px;
    line-height: 1.3;
  }
  .compact ul {
    margin: 8px 0;
    padding-left: 24px;
  }
  .compact li {
    font-size: clamp(18px, 2vw, 23px);
    margin: 7px 0;
    line-height: 1.3;
  }
  .compact .helper {
    font-size: 13px;
  }
  @media (max-width: 700px) {
    .compact h2 {
      font-size: 20px;
    }
    .compact p {
      font-size: 14px;
    }
    .compact li {
      font-size: 18px;
      margin: 5px 0;
    }
    .compact .helper {
      font-size: 12px;
    }
  }
</style>
