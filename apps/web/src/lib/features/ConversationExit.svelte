<script lang="ts">
  import { onMount } from 'svelte';
  let {
    prepare = () => {},
    beforeExit,
    exited,
  }: {
    prepare?: () => void;
    beforeExit: () => Promise<boolean>;
    exited: () => void;
  } = $props();
  let dialog = $state<HTMLDialogElement>(null!);
  let input = $state<HTMLInputElement>(null!);
  let password = $state('');
  let message = $state('');
  let busy = $state(false);
  let locked: Promise<boolean> = Promise.resolve(false);
  onMount(() => {
    locked = fetch('/v1/demo/conversation-lock', {
      method: 'POST',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(6000),
    })
      .then((response) => response.ok)
      .catch(() => false);
  });
  export function requestExit() {
    prepare();
    password = '';
    message = '';
    if (!dialog.open) dialog.showModal();
    input?.focus();
  }
  function updatePasscode(value: string) {
    if (busy) return;
    password = value.replace(/\D/g, '').slice(0, 4);
    if (password.length === 4) void unlock();
  }
  const keys = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ];
  async function unlock(event?: SubmitEvent) {
    event?.preventDefault();
    if (busy || password.length !== 4) return;
    busy = true;
    message = '';
    try {
      if (!(await locked)) {
        message = 'Exit verification is unavailable. Please reload and try again.';
        return;
      }
      if (!(await beforeExit())) {
        message = 'Pause could not be confirmed. Use Stop, then try exiting again.';
        return;
      }
      const response = await fetch('/v1/demo/conversation-exit', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: AbortSignal.timeout(6000),
      });
      password = '';
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        message = result.error ?? 'Exit could not be verified. Please try again.';
        input?.focus();
        return;
      }
      dialog.close();
      exited();
    } catch {
      password = '';
      message = 'Exit verification is unavailable. You are still with Lemmi.';
    } finally {
      busy = false;
    }
  }
</script>

<button
  class="exit"
  onclick={requestExit}
  aria-label="Exit conversation"
  title="Caregiver password required">✕</button
>
<dialog bind:this={dialog} aria-labelledby="exit-title" onclose={() => (password = '')}>
  <div class="passcode-lock" aria-hidden="true">
    <svg
      width="28"
      height="32"
      viewBox="0 0 28 32"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      ><rect x="4" y="13" width="20" height="16" rx="4" /><path d="M8 13V9a6 6 0 0 1 12 0v4" /></svg
    >
  </div>
  <h2 id="exit-title">Enter Passcode</h2>
  <p>To return to the caregiver dashboard</p>
  <form onsubmit={unlock}>
    <div class="passcode-entry">
      <label class="sr-only" for="caregiver-exit-password">Four-digit caregiver passcode</label>
      <input
        bind:this={input}
        id="caregiver-exit-password"
        type="password"
        inputmode="numeric"
        value={password}
        oninput={(event) => updatePasscode(event.currentTarget.value)}
        maxlength="4"
        pattern="[0-9]{4}"
        autocomplete="off"
        required
        disabled={busy}
      />
      <div class="passcode-dots" aria-hidden="true">
        {#each [0, 1, 2, 3] as dot}<span class:filled={password.length > dot}></span>{/each}
      </div>
    </div>
    <div class="passcode-keypad">
      {#each keys as key}<button
          type="button"
          class="passcode-key"
          disabled={busy}
          aria-label={key.digit}
          onclick={() => updatePasscode(password + key.digit)}
          ><span>{key.digit}</span><small aria-hidden="true">{key.letters}</small></button
        >{/each}
      <span></span><button
        type="button"
        class="passcode-key"
        disabled={busy}
        aria-label="0"
        onclick={() => updatePasscode(password + '0')}><span>0</span></button
      >
      <button
        type="button"
        class="passcode-key delete"
        disabled={busy || !password.length}
        aria-label="Delete last digit"
        onclick={() => updatePasscode(password.slice(0, -1))}>⌫</button
      >
    </div>
    <p class="error" role="status" aria-live="polite">{busy ? 'Checking…' : message}</p>
    <button type="button" class="secondary cancel" onclick={() => dialog.close()} disabled={busy}
      >Cancel</button
    >
  </form>
</dialog>

<style>
  .exit {
    position: absolute;
    z-index: 5;
    top: max(12px, env(safe-area-inset-top));
    right: max(12px, env(safe-area-inset-right));
    width: 48px;
    min-height: 48px;
    padding: 8px;
    border: 1px solid #bdc8aa;
    border-radius: 50%;
    background: #fffdf7;
    color: #22331f;
    font-size: 24px;
  }
  dialog {
    width: min(440px, calc(100% - 24px));
    max-height: calc(100dvh - 24px);
    overflow: auto;
    padding: 28px;
    border: 1px solid #bdc8aa;
    border-radius: 24px;
    background: #fffdf7;
    color: #22331f;
  }
  dialog::backdrop {
    background: #25362099;
  }
  h2 {
    margin-top: 0;
  }
  dialog {
    text-align: center;
    width: min(400px, calc(100% - 24px));
  }
  .passcode-entry {
    position: relative;
  }
  input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 56px;
  }
  .passcode-dots {
    display: flex;
    justify-content: center;
    gap: 20px;
    padding: 20px 0;
    margin: 8px 0 16px;
    border-radius: 12px;
  }
  .passcode-entry:focus-within {
    outline: 3px solid #899b72;
    border-radius: 12px;
  }
  .passcode-dots span {
    width: 14px;
    height: 14px;
    border: 1.5px solid #526b43;
    border-radius: 50%;
  }
  .passcode-dots .filled {
    background: #526b43;
  }
  .passcode-keypad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    max-width: 286px;
    margin: auto;
  }
  .passcode-key {
    min-height: 64px;
    margin: 0;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px;
    background: #e7ebe3;
    color: #22331f;
  }
  .passcode-key span {
    font-size: 28px;
  }
  .passcode-key small {
    font-size: 10px;
    letter-spacing: 2px;
    min-height: 13px;
  }
  .delete {
    font-size: 24px;
    background: transparent;
  }
  .cancel {
    width: 100%;
    min-height: 44px;
  }
  .error {
    min-height: 1.5em;
    font-size: 16px;
  }
  @media (max-height: 650px) {
    dialog {
      padding: 18px;
    }
    h2 {
      margin: 8px 0;
    }
    dialog p {
      margin: 8px 0;
    }
    .passcode-key {
      min-height: 48px;
    }
    .passcode-keypad {
      gap: 6px;
    }
    .passcode-dots {
      padding: 12px 0;
      margin: 4px 0 10px;
    }
  }
</style>
