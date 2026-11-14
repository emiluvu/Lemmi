import { chmod, mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ParticipantEnrollmentSchema, ResultSchema } from '@lemmi/contracts';

// Run with private env configuration; no credentials are printed or embedded in firmware.
const args = process.argv.slice(2);
const profileId = args[0];
const output = resolve(args[1] ?? '.data/device-enrollment.json');
const origin = new URL(process.env.LEMMI_PUBLIC_ORIGIN ?? '');
const accessKey = process.env.LEMMI_ACCESS_KEY ?? '';
if (
  !profileId ||
  origin.protocol !== 'https:' ||
  origin.origin !== process.env.LEMMI_PUBLIC_ORIGIN ||
  accessKey.length < 32
)
  throw new Error(
    'Usage: bun scripts/enroll-device.ts <profileId> [output.json]; configure HTTPS origin and private access key',
  );
const schema = ParticipantEnrollmentSchema;
try {
  const stored = JSON.parse(await readFile(output, 'utf8')) as Record<string, unknown>;
  const { origin: savedOrigin, ...savedEnrollment } = stored;
  const enrollment = ParticipantEnrollmentSchema.parse(savedEnrollment);
  if (
    savedOrigin !== origin.origin ||
    enrollment.profileId !== profileId ||
    enrollment.endpoint !== 'robot'
  )
    throw new Error(
      'Stored enrollment belongs to another profile/origin; choose a different output file',
    );
  if (enrollment.expiresAt !== null && Date.parse(enrollment.expiresAt) <= Date.now())
    throw new Error('Stored enrollment expired; remove it explicitly and enroll again');
  console.info(
    'Reusing saved device enrollment. Preserve this private file across normal firmware updates.',
  );
  process.exit(0);
} catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
    throw error;
}
const response = await fetch(`${origin.origin}/v1/demo/enroll`, {
  method: 'POST',
  redirect: 'error',
  signal: AbortSignal.timeout(8000),
  headers: { 'content-type': 'application/json', 'x-lemmi-access-key': accessKey },
  body: JSON.stringify({ profileId, endpoint: 'robot' }),
});
const raw = await response.text();
if (raw.length > 4096) throw new Error('Invalid enrollment response');
const parsed = ResultSchema(schema).safeParse(JSON.parse(raw));
if (!parsed.success || !parsed.data.ok || parsed.data.data.endpoint !== 'robot')
  throw new Error(
    'Enrollment failed; check demo enrollment, profile assignment and private access',
  );
await mkdir(dirname(output), { recursive: true, mode: 0o700 });
await writeFile(
  output,
  JSON.stringify({ origin: origin.origin, ...parsed.data.data }, null, 2) + '\n',
  { mode: 0o600, flag: 'wx' },
);
await chmod(output, 0o600);
console.info(
  'Device enrolled. Private configuration saved; preserve it across normal firmware updates.',
);
