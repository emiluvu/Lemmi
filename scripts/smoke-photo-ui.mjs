// Optional browser regression: run an isolated `LEMMI_UI_PREVIEW=1 bun run
// --filter @lemmi/web dev --port 5195` first. Playwright is supplied by the
// reviewer via LEMMI_PLAYWRIGHT_MODULE; no runtime dependency is added.
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.LEMMI_PLAYWRIGHT_MODULE || 'playwright');
const repoRoot = fileURLToPath(new URL('..', import.meta.url)).slice(0, -1);
import assert from 'node:assert/strict';
const browser = await chromium.launch({
  ...(process.env.LEMMI_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.LEMMI_CHROMIUM_EXECUTABLE }
    : {}),
});
const errors = [];
let portrait = false;
let failImage = false;
let photoRequests = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/v1/demo/current')
      return route.fulfill({
        json: {
          ok: true,
          data: {
            deviceId: 'review-browser',
            profileId: 'profile-alex',
            endpoint: 'browser',
            expiresAt: null,
            profile: {
              id: 'profile-alex',
              preferredName: 'Alex',
              avatarId: 'bunny',
              revision: 0,
              communicationSupport: { preset: 'guided', configVersion: 1 },
              language: 'en',
            },
          },
        },
      });
    if (path.includes('/photo-assets/')) {
      photoRequests++;
      if (failImage) return route.fulfill({ status: 503 });
      const [w, h] = portrait ? [320, 640] : [640, 480];
      return route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="green"/></svg>`,
      });
    }
    return route.fulfill({ json: { ok: true, data: {} } });
  });
  await page.goto(
    `${process.env.LEMMI_UI_REVIEW_ORIGIN || 'http://127.0.0.1:5195'}/preview/application?screen=conversation`,
  );
  await page.locator('.activity-phrases').waitFor();
  await page.evaluate(async (repoRoot) => {
    const { ParticipantConnection } = await import(
      `/@fs${repoRoot}/packages/contracts/src/index.ts`
    );
    const { controlSessionFixture, controlServerEventFixtures, activityScreenFixtures } =
      await import(`/@fs${repoRoot}/packages/contracts/src/fixtures.ts`);
    const { mount } = await import(
      performance.getEntriesByType('resource').find((e) => e.name.includes('/deps/svelte.js?')).name
    );
    const { default: LiveParticipant } = await import('/src/lib/features/LiveParticipant.svelte');
    let connection;
    let session = {
      ...structuredClone(controlSessionFixture),
      activeEndpointId: 'review-browser',
      phase: 'waiting',
      mode: 'live',
      endpoint: 'browser',
      micMuted: false,
    };
    const commands = [];
    const emit = (type, payload) =>
      connection.options.onEvent({
        type,
        payload,
        session_id: session.id,
        generation: session.generation,
      });
    const publish = () => {
      connection.session = structuredClone(session);
      emit('state.changed', { session: connection.session });
    };
    ParticipantConnection.prototype.close = function () {};
    ParticipantConnection.prototype.connect = function () {
      connection = this;
      const ready = controlServerEventFixtures.find((e) => e.type === 'device.ready');
      emit('device.ready', {
        ...ready.payload,
        deviceId: 'review-browser',
        textChat: true,
        teaching: true,
        photoStory: true,
      });
      publish();
    };
    ParticipantConnection.prototype.send = function (type, payload) {
      commands.push({ type, payload });
      if (type === 'input.pause') {
        session = { ...session, phase: 'paused', generation: session.generation + 1 };
        publish();
      }
      return true;
    };
    document.querySelector('.conversation-screen').remove();
    const target = document.createElement('div');
    document.body.append(target);
    mount(LiveParticipant, { target, props: { demoEnrollment: true } });
    const photo = activityScreenFixtures.find(
      (v) => v.activityId === 'photo_album' && v.phase === 'ready',
    );
    window.review = {
      commands,
      showPhoto(asset = 'f1000000-0000-4000-8000-000000000001') {
        publish();
        emit('activity.changed', {
          activity: { ...photo, currentAssetId: asset, caption: 'Fictional garden scene' },
        });
      },
      clearPhoto() {
        emit('activity.changed', { activity: null });
      },
      emit,
      publish,
      refreshAuthority() {
        session = { ...session, privacyRevision: session.privacyRevision + 1 };
        publish();
      },
    };
  }, repoRoot);
  await page.getByRole('button', { name: 'Start listening', exact: true }).waitFor();
  await page.evaluate(() => window.review.showPhoto());
  await page.locator('.picture img').waitFor();
  await page.waitForFunction(() => document.querySelector('.picture img')?.naturalWidth > 0);
  for (const shape of ['landscape', 'portrait']) {
    portrait = shape === 'portrait';
    await page.evaluate(
      (asset) => window.review.showPhoto(asset),
      portrait ? 'f1000000-0000-4000-8000-000000000002' : 'f1000000-0000-4000-8000-000000000001',
    );
    await page.waitForFunction(
      (expected) => document.querySelector('.picture img')?.naturalWidth === expected,
      portrait ? 320 : 640,
    );
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
      { width: 390, height: 650 },
    ]) {
      await page.setViewportSize(viewport);
      const rect = await page.locator('.picture img').boundingBox();
      console.log(
        JSON.stringify({
          shape,
          viewport,
          picture: rect,
          visible: await page.locator('.picture img').isVisible(),
        }),
      );
      assert(rect.width > 0 && rect.height > 0);
      const parent = await page.locator('.picture').boundingBox();
      assert(
        rect.height <= parent.height + 1,
        `photo image overflows its picture frame: ${rect.height} > ${parent.height}`,
      );
    }
  }
  const beforeSnapshots = photoRequests;
  for (let n = 0; n < 20; n++) {
    await page.evaluate(() => window.review.showPhoto('f1000000-0000-4000-8000-000000000002'));
    await page.waitForTimeout(20);
  }
  assert.equal(photoRequests, beforeSnapshots, 'unchanged snapshots reload the protected photo');
  await page.evaluate(() => window.review.refreshAuthority());
  await page.waitForFunction(() => document.querySelector('.picture img')?.naturalWidth === 320);
  assert.equal(
    photoRequests,
    beforeSnapshots + 1,
    'privacy revision did not reauthorize the photo',
  );
  failImage = true;
  await page.evaluate(() => window.review.showPhoto('f1000000-0000-4000-8000-000000000003'));
  await page.getByRole('button', { name: 'Try picture again', exact: true }).waitFor();
  assert((await page.evaluate(() => window.review.commands)).some((c) => c.type === 'input.pause'));
  const beforeRetry = await page.evaluate(() => window.review.commands.length);
  failImage = false;
  await page.getByRole('button', { name: 'Try picture again', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.picture img')?.naturalWidth === 320);
  assert.equal(
    await page.evaluate(() => window.review.commands.length),
    beforeRetry,
    'picture retry sent a control or capture command',
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({ errors, commands: await page.evaluate(() => window.review.commands) }),
  );
} finally {
  await browser.close();
}
