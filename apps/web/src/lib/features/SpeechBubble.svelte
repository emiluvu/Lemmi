<script lang="ts">
  let {
    text,
    side = false,
    readFull,
  }: { text: string; side?: boolean; readFull?: () => void } = $props();
  const shortened = $derived(text.length > 160 && !!readFull);
</script>

<div class="speech-bubble" class:side role="status" aria-live="polite" aria-atomic="true">
  <p>{shortened ? text.slice(0, 160).trimEnd() + '…' : text}</p>
  {#if shortened}<button class="caption-more" onclick={readFull}>Read full caption</button>{/if}
</div>

<style>
  .speech-bubble {
    position: relative;
    padding: 18px 22px;
    border: 2px solid #a6b58b;
    border-radius: 24px;
    background: #fffdf7;
    color: #263b21;
    box-shadow: 0 5px 16px #4b5b3620;
    text-align: left;
  }
  .speech-bubble::before {
    content: '';
    position: absolute;
    width: 18px;
    height: 18px;
    top: -11px;
    left: calc(50% - 10px);
    background: #fffdf7;
    border-top: 2px solid #a6b58b;
    border-left: 2px solid #a6b58b;
    transform: rotate(45deg);
  }
  .side::before {
    top: 28px;
    left: -11px;
    transform: rotate(-45deg);
  }
  p {
    position: relative;
    margin: 0;
    font-size: clamp(18px, 2vw, 23px);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .caption-more {
    min-height: 44px;
    margin: 8px 0 -8px;
    padding: 6px 0;
    border: 0;
    background: transparent;
    color: #344d29;
    text-decoration: underline;
    font-size: 16px;
  }
  @media (max-width: 800px) {
    .speech-bubble {
      padding: 12px 16px;
      border-radius: 20px;
    }
    .side::before {
      top: -11px;
      left: calc(50% - 10px);
      transform: rotate(45deg);
    }
    p {
      font-size: 18px;
      line-height: 1.3;
    }
  }
</style>
