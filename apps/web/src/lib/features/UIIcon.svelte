<script lang="ts">
  let {
    name,
    size = 22,
  }: {
    name:
      | 'profiles'
      | 'music'
      | 'robot'
      | 'settings'
      | 'camera'
      | 'arrow'
      | 'menu'
      | 'close'
      | 'user'
      | 'photos'
      | 'matching'
      | 'chat'
      | 'leaf';
    size?: number;
  } = $props();
  const paths = {
    profiles:
      'M8 20H3v-2a5 5 0 0 1 8-4M17 20h4v-2a5 5 0 0 0-8-4M12 20v-2a4 4 0 0 0-4-4M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    music:
      'M9 18V5l11-2v13M9 8l11-2M6 21c2 0 3-1 3-3s-1-2-3-2-3 1-3 3 1 2 3 2ZM17 19c2 0 3-1 3-3s-1-2-3-2-3 1-3 3 1 2 3 2Z',
    robot: 'M12 3v3M10 3h4M5 8h14v12H5zM2 12v4M22 12v4M9 12v1M15 12v1M9 17h6',
    settings:
      'm9 3-1 3-3 1-2 3 2 3v4l3 1 1 3h6l1-3 3-1v-4l2-3-2-3-3-1-1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    camera: 'M3 7h5l2-3h4l2 3h5v13H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    arrow: 'M5 12h14m-6-6 6 6-6 6',
    menu: 'M4 6h16M4 12h12M4 18h16',
    close: 'm6 6 12 12M6 18 18 6',
    user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
    photos: 'M4 4h16v16H4ZM4 16l5-5 4 4 3-3 4 4M16 8h.01',
    matching: 'M3 4h8v14H3ZM15 6h6v14h-6ZM6 9h2M6 13h2M17 11h2M17 15h2',
    chat: 'M4 4h16v12H9l-5 4ZM8 9h.01M12 9h.01M16 9h.01',
    leaf: 'M5 19C1 9 8 3 21 3c0 12-6 18-16 16ZM5 19 16 8M4 21l1-2',
  };
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name]} /></svg
>
