// Private file parsing for the local server only. Never export this module to a page.
export function voiceAccessSettings(raw: unknown): Record<string, string> {
  try {
    if (!raw || typeof raw !== 'object') throw new Error();
    const value = raw as Record<string, unknown>;
    if (
      value.profileId !== 'profile-alex' ||
      value.deviceId !== 'stackchan-alex' ||
      typeof value.backendUrl !== 'string' ||
      typeof value.credential !== 'string'
    )
      throw new Error();
    const url = new URL(value.backendUrl);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    )
      throw new Error();
    if (value.websocketUrl !== `wss://${url.host}/v1/device-stream`) throw new Error();
    if (!/^[\x21-\x7e]{40,1024}$/.test(value.credential)) throw new Error();
    const headers = value.headers as Record<string, unknown>;
    if (
      !headers ||
      headers.Authorization !== `Bearer ${value.credential}` ||
      typeof headers['X-Lemmi-Access-Key'] !== 'string' ||
      !/^[\x21-\x7e]{32,256}$/.test(headers['X-Lemmi-Access-Key'])
    )
      throw new Error();
    return {
      LEMMI_PUBLIC_ORIGIN: url.origin,
      LEMMI_DEVICE_CREDENTIAL: value.credential,
      LEMMI_ACCESS_KEY: headers['X-Lemmi-Access-Key'],
    };
  } catch {
    throw new Error(
      'Private voice access file is invalid or not scoped to Alex. No credential details were logged.',
    );
  }
}
