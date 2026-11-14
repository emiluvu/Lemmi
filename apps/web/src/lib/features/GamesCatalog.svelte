<script lang="ts">
  import { onMount } from 'svelte';
  import { activityScreenFixtures } from '@lemmi/contracts/fixtures';
  import type { ActivityId } from '@lemmi/contracts';
  import AvatarArt from './AvatarArt.svelte';

  const games = [
    {
      id: 'photo_album',
      name: 'Photo story',
      icon: '▧',
      color: '#d6dfc4',
      description: 'A picture, a little curiosity, and a story to share.',
      concept:
        'Look at a picture together and talk about anything it brings to mind. Simply enjoying the picture is welcome too.',
      steps: [
        'Look at one picture at a time.',
        'Lemmi invites you to share with “Tell me more about this photo!”',
        'Share a thought, take your time, or move on whenever you like.',
      ],
      opportunities:
        'Designed to invite storytelling, personal expression, and shared attention. A picture can be a starting point for a memory someone chooses to share; remembering names or events is never required.',
    },
    {
      id: 'twenty_questions',
      name: '20 questions',
      icon: '?',
      color: '#e9d4b5',
      description: 'You choose something familiar. Lemmi does the guessing.',
      concept:
        'Choose a familiar object from the reviewed set and let Lemmi ask simple yes-or-no questions to guess it. Keep the object or picture visible throughout.',
      steps: [
        'Choose an object or picture and keep it in view.',
        'Answer one question at a time with Yes, No, or Not sure.',
        'Skip a question, ask to see the guess, or finish whenever you like.',
      ],
      opportunities:
        'Designed to offer simple choices, turn-taking, and a chance to think about familiar features. Active recall means bringing information to mind, but this activity does not require remembering a hidden object or test memory.',
    },
    {
      id: 'music_playlist',
      name: 'Music',
      icon: '♫',
      color: '#d3dfe0',
      description: 'Make room for a familiar melody.',
      concept: 'Choose from a reviewed playlist and enjoy listening at your own pace.',
      steps: [
        'Choose an available track.',
        'Use play, pause, or next when you want.',
        'Listening quietly is a complete way to take part.',
      ],
      opportunities:
        'Designed to offer choice and a shared listening experience. Talking about a song is optional.',
    },
    {
      id: 'object_matching',
      name: 'Picture matching',
      icon: '◫',
      color: '#dfd5e0',
      description: 'Explore pictures side by side, without a score.',
      concept: 'Look at a visible sample and choose a matching picture from two options.',
      steps: [
        'Look at the sample picture.',
        'Choose a picture, use Show me, or say Not sure.',
        'Move to another picture or finish at any time.',
      ],
      opportunities:
        'Designed to invite visual attention and simple choices. Pictures stay visible; there is no naming requirement, score, or countdown.',
    },
  ] satisfies {
    id: ActivityId;
    name: string;
    icon: string;
    color: string;
    description: string;
    concept: string;
    steps: string[];
    opportunities: string;
  }[];
  type Game = (typeof games)[number];
  let visibleIds = $state<ActivityId[]>(['photo_album', 'twenty_questions']);
  let selected = $state<Game | null>(null);
  let adding = $state(false);
  let preview = $state(false);
  let notice = $state('');
  let dialog: HTMLDialogElement;
  const guessing = activityScreenFixtures.find(
    (view) => view.activityId === 'twenty_questions' && view.phase === 'ready',
  );
  const moreGames = $derived(games.filter((game) => !visibleIds.includes(game.id)));
  function open(game: Game | null) {
    selected = game;
    adding = game === null;
    preview = false;
    notice = '';
    dialog.showModal();
  }
  function add(game: Game) {
    visibleIds = [...visibleIds, game.id];
    selected = game;
    adding = false;
  }
  onMount(() => () => dialog?.close());
</script>

<div class="catalog-heading">
  <div>
    <p class="eyebrow">Activities at your pace</p>
    <h2>Games & activities</h2>
  </div>
  <span class="catalog-count">{visibleIds.length} activities</span>
</div>
<div class="game-grid">
  {#each games.filter((game) => visibleIds.includes(game.id)) as game}
    <button class="game-card" onclick={() => open(game)} style:--game-color={game.color}>
      <span class="game-art" aria-hidden="true">{game.icon}</span>
      <span class="game-name">{game.name}</span><span class="game-description"
        >{game.description}</span
      >
      <span class="game-link">What’s this game about? <span aria-hidden="true">→</span></span>
    </button>
  {/each}
  <button class="game-card add-game" onclick={() => open(null)}
    ><span class="game-art" aria-hidden="true">+</span><span class="game-name">Add more</span><span
      class="game-description">Explore more activities for your Games tab.</span
    ></button
  >
</div>

<dialog
  bind:this={dialog}
  class="game-dialog"
  aria-labelledby="game-dialog-title"
  onclose={() => {
    selected = null;
    adding = false;
    preview = false;
  }}
>
  <header class="game-dialog-header">
    <h2 id="game-dialog-title">
      {adding
        ? 'Add an activity'
        : preview
          ? `${selected?.name} preview`
          : 'What’s this game about?'}
    </h2>
    <button class="secondary" aria-label="Close game details" onclick={() => dialog.close()}
      >✕</button
    >
  </header>
  {#if adding}
    <p>Add an existing activity to this tab. Your choices last until you leave this page.</p>
    {#each moreGames as game}<button class="catalog-option" onclick={() => add(game)}
        ><strong>{game.name}</strong><span>{game.description}</span><span>Add +</span></button
      >{/each}
    {#if !moreGames.length}<p>All available activities are on your Games tab.</p>{/if}
    <p class="catalog-note">New custom games are not available yet.</p>
  {:else if selected}
    {#if preview}
      <button class="secondary" onclick={() => (preview = false)}>← About this game</button>
      <p class="catalog-note">Visual preview · no session, microphone, or saved results</p>
      <section class="game-preview" aria-label={`${selected.name} visual preview`}>
        <div class="preview-mascot"><AvatarArt avatarId="lemming" /></div>
        {#if selected.id === 'photo_album'}
          <div class="preview-photo">
            <img
              src="/images/photo-story-bubbles.png"
              alt="A caramel lemming and a blue bird blowing colorful soap bubbles together."
            />
          </div>
          <h3>Tell me more about this photo!</h3>
          <p class="catalog-note">This Games preview never uses photos uploaded to a profile.</p>
        {:else if selected.id === 'twenty_questions' && guessing?.activityId === 'twenty_questions'}
          <p>Take your time. You can keep your object in view.</p>
          <h3>{guessing.question}</h3>
          <div class="preview-choices">
            {#each guessing.choices as choice}<button
                class="secondary"
                onclick={() =>
                  (notice =
                    'This is a sample screen. Answers do not advance a game or save a result.')}
                >{choice.label}</button
              >{/each}
          </div>
        {:else}
          <h3>{selected.name}</h3>
          <p>{selected.concept}</p>
          <p>
            Reviewed {selected.id === 'music_playlist' ? 'audio' : 'picture'} assets are not connected
            to this preview yet.
          </p>
        {/if}
        <p role="status">{notice}</p>
      </section>
    {:else}
      <div class="game-overview" style:--game-color={selected.color}>
        <span aria-hidden="true">{selected.icon}</span>
        <h3>{selected.name}</h3>
        <p>{selected.concept}</p>
      </div>
      <section class="game-info">
        <h3>How to play</h3>
        <ol>
          {#each selected.steps as step}<li>{step}</li>{/each}
        </ol>
      </section>
      <section class="game-info opportunities">
        <h3>What it offers</h3>
        <p>{selected.opportunities}</p>
        <p class="catalog-note">
          An invitation to enjoy an activity together; no memory improvement or clinical benefit is
          claimed.
        </p>
      </section>
      <button class="preview-button" onclick={() => (preview = true)}
        >Preview game <span aria-hidden="true">→</span></button
      >
    {/if}
  {/if}
</dialog>

<style>
  .catalog-heading,
  .game-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .catalog-heading h2 {
    margin-top: 0;
  }
  .catalog-count {
    color: #526044;
    font-size: 16px;
  }
  .game-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    gap: 22px;
  }
  .game-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    padding: 0;
    overflow: hidden;
    border: 2px solid var(--outline-brown);
    border-radius: 22px;
    background: #fffdf7;
    color: var(--ink);
    box-shadow: 0 5px 0 #684b3215;
  }
  .game-card:hover {
    background: #f8f1e5;
    transform: translateY(-2px);
  }
  .game-art {
    display: grid;
    place-items: center;
    min-height: 138px;
    background: var(--game-color, #e8dcc6);
    color: #594732;
    font-size: 62px;
  }
  .game-name {
    font-size: 26px;
    font-weight: 750;
    padding: 20px 22px 6px;
  }
  .game-description {
    font-weight: 400;
    font-size: 18px;
    padding: 0 22px 20px;
    flex: 1;
  }
  .game-link {
    display: flex;
    justify-content: space-between;
    padding: 15px 22px;
    background: #e6ebd9;
    font-size: 16px;
  }
  .add-game {
    border-style: dashed;
    background: #f3eadc;
  }
  .game-dialog {
    width: min(780px, calc(100% - 32px));
    max-height: calc(100dvh - 40px);
    padding: 26px;
    border: 3px solid var(--outline-brown);
    border-radius: 24px;
    background: #fffdf7;
    color: var(--ink);
  }
  .game-dialog::backdrop {
    background: #24302066;
  }
  .game-dialog-header h2 {
    font-size: clamp(24px, 4vw, 32px);
    margin: 0;
  }
  .game-dialog-header button {
    flex-shrink: 0;
  }
  .game-overview {
    margin-top: 24px;
    padding: 24px;
    border-radius: 18px;
    background: var(--game-color);
  }
  .game-overview > span {
    font-size: 40px;
  }
  .game-overview h3 {
    font-size: 30px;
    margin: 4px 0;
  }
  .game-info {
    margin-top: 20px;
    padding: 20px;
    background: #f5ebdc;
    border-radius: 16px;
  }
  .game-info h3 {
    margin: 0 0 10px;
  }
  .game-info li {
    margin-bottom: 10px;
  }
  .game-info p {
    margin-bottom: 0;
  }
  .catalog-note {
    font-size: 16px;
    color: #535348;
  }
  .preview-button {
    width: 100%;
    margin-top: 24px;
  }
  .catalog-option {
    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 8px;
    width: 100%;
    margin: 16px 0;
    padding: 18px;
    background: #e6ebd9;
    color: var(--ink);
    text-align: left;
  }
  .catalog-option span {
    font-weight: 400;
    font-size: 17px;
  }
  .game-preview {
    text-align: center;
    background: #f5ebdc;
    padding: 24px;
    border-radius: 18px;
    margin-top: 20px;
  }
  .preview-mascot {
    height: 120px;
    width: 130px;
    margin: auto;
  }
  .preview-photo {
    overflow: hidden;
    border: 2px solid #aa997d;
    border-radius: 16px;
    background: #fff5df;
  }
  .preview-photo img {
    display: block;
    width: 100%;
    max-height: 55dvh;
    object-fit: contain;
  }
  .preview-choices {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  @media (prefers-reduced-motion: reduce) {
    .game-card:hover {
      transform: none;
    }
  }
  @media (max-width: 500px) {
    .game-dialog {
      padding: 18px;
    }
    .catalog-count {
      display: none;
    }
  }
</style>
