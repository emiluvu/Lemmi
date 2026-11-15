import { defineEnvVars } from '@sveltejs/kit/env';

function flag(fallback: boolean) {
  return (value: string | undefined) => {
    if (value === undefined || value === '') return fallback;
    if (value !== '0' && value !== '1') throw new Error('Use 0 or 1');
    return value === '1';
  };
}
export const variables = defineEnvVars({
  PUBLIC_LEMMI_AUTO_TURN_END: { public: true, schema: flag(true) },
  PUBLIC_LEMMI_SPEECH_DIAGNOSTICS: { public: true, schema: flag(false) },
  PUBLIC_LEMMI_END_SILENCE_MS: {
    public: true,
    schema: (value) => {
      const ms = Number(value || 1500);
      if (!Number.isInteger(ms) || ms < 1500 || ms > 8000)
        throw new Error('End silence must be 1500–8000 ms');
      return ms;
    },
  },
});
