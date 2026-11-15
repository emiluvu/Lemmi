<script lang="ts">
  import { asset } from '$app/paths';

  let { size = 44 }: { size?: number } = $props();
</script>

<!-- Frame the supplied artwork without its transparent outer margins. -->
<svg width={size} height={size} viewBox="373 153 681 681" aria-hidden="true" focusable="false">
  <image href={asset('images/brand/lemmi.png')} width="1312" height="1199" />
</svg>

<style>
  svg {
    display: block;
    flex: none;
    overflow: hidden;
  }
</style>
