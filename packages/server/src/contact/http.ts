import {
  HelpHttpRequestSchema,
  HelpCreateBodySchema,
  HelpSnapshotSchema,
  ResultSchema,
  fail,
  type Fetcher,
} from '@lemmi/contracts';
import { authenticateCaregiver } from '../caregiver-auth';
import { controlResponse } from '../control-config';
import type { DeviceHttpConfig } from '../device-http';
import { boundedJson } from '../http-body';

export async function handleHelpHttp(
  request: Request,
  route: { profileId: string; requestId?: string; action?: 'acknowledge' | 'cancel' | 'resolve' },
  config: DeviceHttpConfig,
  fetcher: Fetcher = fetch,
) {
  const action = route.action ?? (route.requestId ? 'status' : 'create');
  const url = new URL(request.url);
  if (request.method !== (action === 'status' ? 'GET' : 'POST'))
    return new Response(null, { status: 405, headers: { 'cache-control': 'no-store' } });
  if (
    url.origin !== config.publicOrigin ||
    url.search ||
    (request.headers.has('origin') && request.headers.get('origin') !== config.publicOrigin)
  )
    return controlResponse(fail('FORBIDDEN', 'Same-origin HTTPS required'));
  const verified = await authenticateCaregiver(request, config.auth, fetcher);
  if (!verified.ok) return controlResponse(verified);
  let commandId: unknown;
  if (action === 'create') {
    try {
      const body = await boundedJson(request);
      const parsed = HelpCreateBodySchema.safeParse(body);
      if (!parsed.success) return controlResponse(fail('VALIDATION_ERROR', 'Invalid help request'));
      commandId = parsed.data.commandId;
    } catch {
      return controlResponse(fail('VALIDATION_ERROR', 'Invalid help request'));
    }
  }
  const command = HelpHttpRequestSchema.safeParse({
    action,
    actor: verified.data.subject,
    profileId: route.profileId,
    ...(action === 'create' ? { commandId } : { requestId: route.requestId }),
  });
  if (!command.success || route.profileId.startsWith('preview-'))
    return controlResponse(fail('VALIDATION_ERROR', 'Invalid help scope'));
  try {
    const response = await fetcher(`http://127.0.0.1:${config.gatewayPort}/internal/help`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
      headers: {
        authorization: `Bearer ${config.internalToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(command.data),
    });
    const parsed = ResultSchema(HelpSnapshotSchema).safeParse(await boundedJson(response));
    return controlResponse(
      parsed.success ? parsed.data : fail('UNAVAILABLE', 'Invalid contact response'),
    );
  } catch {
    return controlResponse(
      fail('UNAVAILABLE', 'Contact status unavailable; retry with the same command ID'),
    );
  }
}
