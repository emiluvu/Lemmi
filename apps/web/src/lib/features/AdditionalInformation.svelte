<script lang="ts">
  let files = $state<File[]>([]);
  let error = $state('');
  function selectFiles(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    error = '';
    if (selected.length + files.length > 5)
      error = 'Choose up to five files for this temporary list.';
    else if (
      selected.some((file) => file.size > 10 * 1024 * 1024 || !/\.(pdf|docx|txt)$/i.test(file.name))
    )
      error = 'Choose PDF, DOCX, or TXT files, up to 10 MB each.';
    else files = [...files, ...selected];
    input.value = '';
  }
</script>

<section class="additional-information" aria-labelledby="additional-information-title">
  <h2 id="additional-information-title">Additional Information</h2>
  <p>
    Add caregiver-provided background, interests, and history for review as conversation context.
  </p>
  <div class="information-upload">
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" /></svg
    >
    <h3>History & supporting files</h3>
    <p>PDF, Word, or text · Up to 10 MB each</p>
    <label class="information-file-picker"
      >Choose files<input
        type="file"
        multiple
        accept=".pdf,.docx,.txt"
        onchange={selectFiles}
        aria-label="Choose additional information files"
      /></label
    >
    <p class="helper">
      Temporary selection only. Files are not uploaded, read, saved, or used by AI. This list clears
      when the profile closes.
    </p>
  </div>
  <p role="status">{error}</p>
  {#if files.length}<ul class="information-files">
      {#each files as file, index}<li>
          <div>
            <strong>{file.name}</strong><span>Not uploaded · {Math.ceil(file.size / 1024)} KB</span>
          </div>
          <button
            type="button"
            class="quiet"
            aria-label={`Remove ${file.name} from selection`}
            onclick={() => (files = files.filter((_, position) => position !== index))}
            >Remove</button
          >
        </li>{/each}
    </ul>{/if}
  <p class="helper">
    Before AI use is available, each file will need caregiver review and explicit context approval.
    Uploaded content must remain source-labeled and must not automatically change biography or
    override help, stop, or privacy controls.
  </p>
</section>
