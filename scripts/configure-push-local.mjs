import { webcrypto, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const force = process.argv.includes('--force');
const envPath = resolve('supabase/functions/ours-push-dispatch/.env.local');
if (existsSync(envPath) && !force) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: 'LOCAL_PUSH_CONFIG_ALREADY_EXISTS', path: envPath }));
  process.exit(0);
}

const subtle = webcrypto.subtle;
const keys = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = await subtle.exportKey('jwk', keys.publicKey);
const privateKey = await subtle.exportKey('jwk', keys.privateKey);
const rawPublic = new Uint8Array(await subtle.exportKey('raw', keys.publicKey));
const applicationServerKey = Buffer.from(rawPublic).toString('base64url');
const dispatchSecret = randomBytes(48).toString('base64url');

const env = [
  `VAPID_PUBLIC_JWK=${JSON.stringify(publicKey)}`,
  `VAPID_PRIVATE_JWK=${JSON.stringify(privateKey)}`,
  'VAPID_SUBJECT=mailto:ours-private@example.com',
  `OURS_PUSH_DISPATCH_SECRET=${dispatchSecret}`,
  '',
].join('\n');
writeFileSync(envPath, env, { encoding: 'utf8', mode: 0o600 });

const configPath = resolve('cloud-config.js');
const current = readFileSync(configPath, 'utf8');
const next = current.replace(/vapidPublicKey:\s*''/, `vapidPublicKey: '${applicationServerKey}'`);
if (next === current && !current.includes(applicationServerKey)) {
  throw new Error('cloud-config.js vapidPublicKey field was not updated');
}
writeFileSync(configPath, next, 'utf8');
console.log(JSON.stringify({ ok: true, envPath, vapidPublicKey: applicationServerKey, dispatchSecretStoredLocally: true }));
