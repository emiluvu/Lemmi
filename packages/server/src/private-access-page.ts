import { createHash } from 'node:crypto';

// This page precedes the app shell. Reuse only the already-public brand assets;
// hash its fixed stylesheet so the gate needs neither scripts nor unsafe-inline.
const styles = `
@font-face {
  font-family: Nunito;
  src: url("/fonts/nunito-latin-variable.ttf") format("truetype");
  font-style: normal;
  font-weight: 200 900;
  font-display: swap;
}
:root {
  color-scheme: light;
  --ink: #35432e;
  --brand: #3b512e;
  --brown: #684b32;
  --line: #c7b799;
  --paper: #fffdf7;
  --sage: #e9eddf;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  min-height: 100vh;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  background: #f3eadf url("/images/surfaces/cream-paper-v1.png") center/640px;
  color: var(--ink);
  font:
    18px/1.6 Nunito,
    ui-rounded,
    system-ui,
    sans-serif;
}
.masthead {
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(1100px, 100%);
  margin: 0 auto;
  padding: 28px 32px;
}
.brand-mark {
  display: block;
  flex: none;
  width: 48px;
  height: 48px;
}
.wordmark {
  font-size: 32px;
  font-weight: 900;
  letter-spacing: -1.5px;
}
.masthead-note {
  margin-left: auto;
  font-size: 14px;
  color: #59634d;
}
main {
  display: grid;
  place-items: center;
  flex: 1;
  padding: 24px 32px 48px;
}
.welcome {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: min(980px, 100%);
  border: 2px solid var(--brown);
  border-radius: 28px;
  background: var(--paper);
  box-shadow:
    0 5px 0 #bda88a30,
    0 20px 60px #684b3214;
  overflow: hidden;
}
.intro {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 38px;
  text-align: center;
  background:
    linear-gradient(150deg, #eef0dfd9, #dce4cbd9),
    url("/images/surfaces/cream-paper-v1.png") center/640px;
  border-right: 1px solid var(--line);
}
.logo-frame {
  display: grid;
  place-items: center;
  width: 196px;
  height: 196px;
  margin-bottom: 28px;
  border: 1px solid #a7b18f;
  border-radius: 50%;
  background: #fffaf0;
  box-shadow: 0 4px 0 #9eac8226;
}
.hero-mark {
  width: 174px;
  height: 174px;
}
.intro-heading {
  margin: 0;
  color: #3d4e30;
  font-size: clamp(28px, 3.5vw, 38px);
  font-weight: 850;
  line-height: 1.2;
  letter-spacing: -1px;
}
.intro-copy {
  max-width: 28ch;
  margin: 18px 0 0;
  color: #4d5b40;
}
.intro-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 32px 0 0;
  padding: 8px 14px;
  border: 1px solid #bcc6a6;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 750;
  background: #f9faef99;
}
.little-flower {
  width: 18px;
  height: 18px;
  flex: none;
}
.entry {
  padding: 52px 44px;
}
.eyebrow {
  margin: 0 0 14px;
  color: #667350;
  font-size: 12px;
  font-weight: 850;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: clamp(28px, 3.5vw, 36px);
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -1.1px;
}
.lead {
  margin: 14px 0 28px;
  color: #59634d;
}
label {
  display: block;
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 800;
}
input {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 56px;
  padding: 12px 16px;
  border: 1.5px solid #9a9d84;
  border-radius: 13px;
  background: #fffcf5;
  color: var(--ink);
  font: inherit;
  box-shadow: inset 0 2px 4px #806f4c08;
}
input[aria-invalid="true"] {
  border-color: #9b462b;
}
.field-note {
  margin: 10px 0 22px;
  font-size: 14px;
  color: #59634d;
}
button,
.button-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 12px 18px;
  border: 1.5px solid #304425;
  border-radius: 13px;
  background: linear-gradient(#526d3d, #3b512e);
  box-shadow:
    inset 0 1px 0 #ffffff26,
    0 3px 0 #263a2420;
  color: #fffdf7;
  font: inherit;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  overflow-wrap: anywhere;
}
button:hover,
.button-link:hover {
  background: #304425;
}
.arrow {
  width: 20px;
  height: 20px;
  flex: none;
}
input:focus-visible,
button:focus-visible,
a:focus-visible {
  outline: 3px solid #a64d20;
  outline-offset: 4px;
}
.privacy-note {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 24px 0 0;
  padding-top: 22px;
  border-top: 1px dashed #d4cbb7;
  color: #59634d;
  font-size: 13px;
}
.privacy-note svg {
  width: 17px;
  height: 17px;
  flex: none;
  margin-top: 2px;
}
.notice {
  padding: 12px 15px;
  margin: 0 0 24px;
  border: 1px solid #b5c19e;
  border-radius: 12px;
  background: #edf1e3;
  color: #35432e;
  font-size: 16px;
}
.notice.error {
  border-color: #c8987f;
  background: #fbede3;
  color: #783b24;
}
.entry-links {
  display: grid;
  gap: 14px;
}
.secondary {
  background: #f0eddf;
  border-color: #b7ad91;
  color: #3d4e30;
  box-shadow:
    inset 0 1px 0 white,
    0 3px 0 #b9ad9326;
}
.secondary:hover {
  background: #e5e8d7;
}
.lock-form {
  margin-top: 24px;
  text-align: center;
}
.lock-button {
  display: inline-flex;
  width: auto;
  min-height: 48px;
  padding: 10px 8px;
  border: 0;
  background: none;
  color: #4d5b40;
  box-shadow: none;
  font-size: 15px;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.lock-button:hover {
  background: #edf0e4;
}
footer {
  padding: 0 24px 24px;
  text-align: center;
  font-size: 13px;
  color: #59634d;
}
@media (max-width: 720px) {
  .masthead {
    padding: 20px 24px;
  }
  .masthead-note {
    display: none;
  }
  main {
    padding: 8px 20px 32px;
  }
  .welcome {
    grid-template-columns: 1fr;
    max-width: 470px;
    border-radius: 22px;
  }
  .intro {
    padding: 26px 24px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
  .logo-frame {
    width: 112px;
    height: 112px;
    margin-bottom: 16px;
  }
  .hero-mark {
    width: 102px;
    height: 102px;
  }
  .intro-heading {
    font-size: 26px;
  }
  .intro-copy {
    margin-top: 10px;
    font-size: 16px;
    max-width: 32ch;
  }
  .intro-note {
    display: none;
  }
  .entry {
    padding: 30px 26px;
  }
  .lead {
    font-size: 17px;
    margin-bottom: 24px;
  }
}
@media (max-width: 360px) {
  .masthead {
    padding: 16px;
  }
  main {
    padding: 8px 12px 24px;
  }
  .entry {
    padding: 26px 20px;
  }
  .intro {
    padding: 24px 20px;
  }
}
`;

export const privateAccessPagePolicy =
  `default-src 'none'; style-src 'sha256-${createHash('sha256').update(styles).digest('base64')}'; ` +
  "img-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

type AccessPageState = 'locked' | 'unlocked' | 'rejected' | 'signed-out' | 'rate-limited';

const logo = (className: string) =>
  `<svg class="${className}" viewBox="373 153 681 681" aria-hidden="true" focusable="false"><image href="/images/brand/lemmi.png" width="1312" height="1199" /></svg>`;
const arrow = `<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>`;

export function privateAccessPage(state: AccessPageState): string {
  const unlocked = state === 'unlocked';
  const error = state === 'rejected' || state === 'rate-limited';
  const notice = {
    locked: '',
    unlocked: 'This browser is unlocked. Choose where you’d like to go.',
    rejected: 'Access key not accepted. Please check it and try again.',
    'signed-out': 'This browser is locked.',
    'rate-limited': 'Too many attempts. Please wait a minute before trying again.',
  }[state];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#f3eadf">
<meta name="description" content="A little company. A familiar rhythm. Welcome to your Lemmi space.">
<title>Welcome to Lemmi</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>${styles}</style>
</head>
<body>
<header class="masthead">${logo('brand-mark')}<span class="wordmark">Lemmi</span><span class="masthead-note">A little company. A familiar rhythm.</span></header>
<main>
<div class="welcome">
<section class="intro" aria-label="A little company">
  <div class="logo-frame">${logo('hero-mark')}</div>
  <p class="intro-heading">A little company.<br>A familiar rhythm.</p>
  <p class="intro-copy">Room for a conversation, a shared moment, or something you enjoy.</p>
  <p class="intro-note"><svg class="little-flower" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 22v-8m0 5c-5 0-7-3-7-3s5-1 7 3m0-2c5 0 7-3 7-3s-5-1-7 3"/><path d="M12 4c-4-5-8 1-4 3-5 0-4 7 1 5-2 5 5 6 5 1 4 3 8-3 3-5 4-3-2-8-5-4Z"/></svg>At your own pace</p>
</section>
<section class="entry" aria-labelledby="welcome-title">
  <p class="eyebrow">Your Lemmi space</p>
  <h1 id="welcome-title">${unlocked ? 'You’re right at home.' : 'Welcome to Lemmi'}</h1>
  <p class="lead">${unlocked ? 'A little company is just a step away.' : 'Enter your access key to come on in.'}</p>
  ${notice ? `<p class="notice${error ? ' error' : ''}" id="access-notice" role="${error ? 'alert' : 'status'}">${notice}</p>` : ''}
  ${
    unlocked
      ? `<div class="entry-links"><a class="button-link" href="/caregiver">Open caregiver workspace ${arrow}</a><a class="button-link secondary" href="/participant/conversation">Open participant ${arrow}</a></div><form class="lock-form" method="post" action="/access/logout"><button class="lock-button" type="submit">Lock this browser</button></form>`
      : `<form method="post" action="/access"><label for="access-key">Access key</label><input id="access-key" name="key" type="password" required maxlength="256" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="key-help${error ? ' access-notice' : ''}"${state === 'rejected' ? ' aria-invalid="true"' : ''}><p class="field-note" id="key-help">Use the key shared with you by the Lemmi team.</p><button type="submit">Unlock Lemmi ${arrow}</button></form>`
  }
  <p class="privacy-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></svg><span>Caregiver sign-in is separate from this access key.</span></p>
</section>
</div>
</main>
<footer>A little space for familiar moments.</footer>
</body>
</html>`;
}
