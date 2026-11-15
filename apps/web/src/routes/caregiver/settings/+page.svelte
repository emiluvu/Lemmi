<script lang="ts">
  import PhotoPicker from '#lib/features/PhotoPicker.svelte';
  let passwordInfoOpen = $state(false);
</script>

<svelte:head><title>Caregiver settings — Lemmi</title></svelte:head>
<div class="caregiver-settings">
  <p class="eyebrow">Your account</p>
  <h1>Caregiver Setting</h1>
  <section class="account-section" aria-labelledby="caregiver-photo-title">
    <h2 id="caregiver-photo-title">Profile photo</h2>
    <div class="photo-setting">
      <PhotoPicker label="Caregiver photo" initials="CG" />
      <p>
        Choose a photo for your caregiver account.<br /><small>JPG, PNG, or WebP · Up to 5 MB</small
        >
      </p>
    </div>
  </section>
  <section class="account-section" aria-labelledby="account-details-title">
    <h2 id="account-details-title">Account details</h2>
    <div class="account-fields">
      <label for="caregiver-email">Email</label>
      <input
        id="caregiver-email"
        type="email"
        placeholder="Email unavailable until sign-in is connected"
        disabled
        aria-describedby="account-availability"
      />
      <label for="caregiver-password">Password</label>
      <input
        id="caregiver-password"
        type="password"
        placeholder="Password not connected"
        disabled
        aria-describedby="account-availability"
      />
      <button
        class="secondary change-password"
        aria-expanded={passwordInfoOpen}
        aria-controls="password-availability"
        onclick={() => (passwordInfoOpen = !passwordInfoOpen)}>Change password</button
      >
      <p id="password-availability" hidden={!passwordInfoOpen} role="status">
        Password changes will be available once secure caregiver sign-in is connected. No password
        is collected here.
      </p>
      <p id="account-availability" class="account-note">
        Caregiver sign-in and account updates are not connected yet. Photo previews last until you
        reload this tab.
      </p>
    </div>
  </section>
</div>

<style>
  .caregiver-settings {
    max-width: 880px;
    margin: 0 auto;
    padding: 12px 0 40px;
  }
  .caregiver-settings h1 {
    font-size: clamp(32px, 5vw, 46px);
    margin: 4px 0 28px;
  }
  .account-section {
    margin-bottom: 24px;
    border: 2px solid #b7a084;
    border-radius: 22px;
    overflow: hidden;
    background: #fffdf8;
  }
  .account-section h2 {
    margin: 0;
    padding: 18px 24px;
    background: #e8d5b9;
    color: #443624;
    font-size: 24px;
  }
  .photo-setting {
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 24px;
    flex-wrap: wrap;
  }
  .photo-setting small,
  .account-note {
    color: #5e584c;
    font-size: 16px;
  }
  .account-fields {
    display: grid;
    gap: 12px;
    padding: 24px;
  }
  .account-fields label {
    font-weight: 700;
  }
  .account-fields input {
    width: 100%;
    min-width: 0;
    padding: 14px 16px;
    border: 1px solid #b4aa96;
    border-radius: 10px;
    font: inherit;
    background: #f5f1e9;
    color: #514d42;
  }
  .account-fields input::placeholder {
    color: #645f53;
    opacity: 1;
  }
  .change-password {
    justify-self: start;
  }
  .account-note {
    margin: 6px 0 0;
  }
  @media (max-width: 600px) {
    .photo-setting,
    .account-fields {
      padding: 18px;
    }
    .photo-setting {
      gap: 16px;
    }
  }
</style>
