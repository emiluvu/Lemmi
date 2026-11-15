import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readBounded, type AdapterFetch } from '../adapters/types';
import { abortable } from '../adapters/conversation-decisions';

export interface TelegramConfig {
  token: string;
  chatId: string;
  backupChatId?: string;
  safeChatId?: string;
  profileIds: string[];
  subject: string;
  autoAlerts: boolean;
  portalUrl?: string;
}
// Same lookup precedence as ~/.local/bin/tg-notify; values never enter logs or public contracts.
export async function telegramConfig(
  env: Record<string, string | undefined> = process.env,
  home = homedir(),
): Promise<TelegramConfig | null> {
  if (!env.LEMMI_TELEGRAM_ENABLED || env.LEMMI_TELEGRAM_ENABLED === '0') return null;
  if (
    env.LEMMI_MODE !== 'live' ||
    env.LEMMI_TELEGRAM_ENABLED !== '1' ||
    !env.LEMMI_DATABASE_URL ||
    env.LEMMI_TELEGRAM_RECIPIENTS_VERIFIED !== '1'
  )
    throw new Error(
      'Telegram contact requires live mode, PostgreSQL and explicitly verified opted-in test recipients',
    );
  const files: Record<string, string>[] = [];
  for (const path of [join(home, '.config/telegram-notify/env'), join(home, '.kiro/crew/.env')]) {
    try {
      const content = await readFile(path, 'utf8');
      const values: Record<string, string> = {};
      for (const line of content.split('\n')) {
        const match = line.trim().match(/^(TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=(.*)$/);
        if (match) values[match[1]!] = match[2]!.trim().replace(/^["']|["']$/g, '');
      }
      files.push(values);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Cannot read private Telegram configuration');
    }
  }
  const lookup = (key: string) =>
    env[key]?.trim() || files.map((file) => file[key]).find(Boolean) || '';
  const token = lookup('TELEGRAM_BOT_TOKEN');
  let chatId = lookup('TELEGRAM_CHAT_ID');
  if (!chatId) {
    try {
      const config = JSON.parse(await readFile(join(home, '.kiro/crew/config.json'), 'utf8'));
      chatId = String(config.telegram?.allowed_user_ids?.[0] ?? '');
    } catch {
      /* Missing legacy fallback is handled by validation below. */
    }
  }
  const profileIds = (env.LEMMI_TELEGRAM_PROFILE_IDS ?? 'profile-alex')
    .split(',')
    .map((id) => id.trim());
  const config = {
    token,
    chatId,
    profileIds,
    backupChatId: env.LEMMI_TELEGRAM_BACKUP_CHAT_ID?.trim() || undefined,
    safeChatId: env.LEMMI_TELEGRAM_SAFE_CHAT_ID?.trim() || undefined,
    subject: env.LEMMI_CAREGIVER_SUBJECT ?? '',
    autoAlerts: env.LEMMI_TELEGRAM_AUTO_ALERTS === '1',
    portalUrl: env.LEMMI_PUBLIC_ORIGIN
      ? new URL('/caregiver', env.LEMMI_PUBLIC_ORIGIN).href
      : undefined,
  };
  if (
    !/^\d{5,}:[\w-]{20,}$/.test(token) ||
    !/^-?\d{1,20}$/.test(chatId) ||
    !config.subject ||
    config.subject.length > 200 ||
    profileIds.length > 100 ||
    !profileIds.length ||
    profileIds.some((id) => !/^[\w-]{1,100}$/.test(id) || id.startsWith('preview-')) ||
    new Set(profileIds).size !== profileIds.length ||
    [config.backupChatId, config.safeChatId].some((id) => id && !/^-?\d{1,20}$/.test(id)) ||
    (config.safeChatId && [chatId, config.backupChatId].includes(config.safeChatId)) ||
    (config.backupChatId && config.backupChatId === chatId) ||
    !['0', '1', undefined].includes(env.LEMMI_TELEGRAM_AUTO_ALERTS) ||
    (config.portalUrl &&
      (new URL(config.portalUrl).protocol !== 'https:' ||
        new URL(config.portalUrl).username ||
        new URL(config.portalUrl).password))
  )
    throw new Error('Invalid private Telegram contact configuration');
  return config;
}

export type TelegramResult =
  | { status: 'accepted'; messageId: number }
  | { status: 'retry'; delayMs: number }
  | { status: 'failed' | 'unknown' };
export interface TelegramSender {
  send(chatId: string, message: string, signal: AbortSignal): Promise<TelegramResult>;
}
export function createTelegramSender(token: string, fetcher: AdapterFetch = fetch): TelegramSender {
  return {
    async send(chatId, message, canceled) {
      const signal = AbortSignal.any([canceled, AbortSignal.timeout(15000)]);
      try {
        signal.throwIfAborted();
        const response = await abortable(
          () =>
            fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              redirect: 'error',
              signal,
              headers: { 'content-type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                chat_id: chatId,
                text: message.slice(0, 4000),
                disable_web_page_preview: 'true',
              }).toString(),
            }),
          signal,
        );
        const data = JSON.parse(new TextDecoder().decode(await readBounded(response, 16384)));
        if (
          response.ok &&
          data.ok === true &&
          Number.isSafeInteger(data.result?.message_id) &&
          String(data.result?.chat?.id) === chatId
        )
          return { status: 'accepted', messageId: data.result.message_id };
        // Only an explicit rejection can be retried. Telegram has no send idempotency key.
        if (
          response.status === 429 &&
          data.ok === false &&
          Number.isInteger(data.parameters?.retry_after) &&
          data.parameters.retry_after >= 1 &&
          data.parameters.retry_after <= 15
        )
          return { status: 'retry', delayMs: data.parameters.retry_after * 1000 };
        if (response.status >= 400 && response.status < 500 && data.ok === false)
          return { status: 'failed' };
        return { status: 'unknown' };
      } catch {
        // No response, timeout or a malformed success may have followed a successful send.
        return { status: 'unknown' };
      }
    },
  };
}
