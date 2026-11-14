import { ok, type Result } from '@lemmi/contracts';
import type { ChatAdapter } from './types';
// Explicit offline rehearsal adapter, selected before requests; never a failed-live fallback.
export function reviewedPhotoDemo(): ChatAdapter {
  return {
    async complete(input, signal) {
      signal.throwIfAborted();
      const quiet = input.system.includes('"preset":"quiet"');
      const guided = input.system.includes('"preset":"guided"');
      const park = input.system.includes('bench in a leafy park');
      const uncertainty = /\b(?:don.?t know|do not know|not sure|can.?t remember)\b/i.test(
        input.text,
      );
      let text: string;
      if (quiet)
        text = uncertainty
          ? 'That is okay. We can simply look.'
          : park
            ? 'A peaceful park scene.'
            : 'Flowers in a garden.';
      else if (uncertainty)
        text = guided
          ? 'That is okay. Would you like to simply look?'
          : 'That is okay. What catches your eye in this picture?';
      else if (input.text.includes('opening'))
        text = guided
          ? park
            ? 'Would you enjoy sitting on this bench?'
            : 'Do you like flowers?'
          : park
            ? 'What do you like about this park scene?'
            : 'What do you enjoy about gardens?';
      else if (/roses/i.test(input.text))
        text = guided ? 'Do you enjoy the colours of roses?' : 'What do you like about roses?';
      else
        text = guided
          ? 'Would you like to look at another photo?'
          : 'What else would you like to share about this scene?';
      return ok({ text, language: input.language });
    },
  };
}
