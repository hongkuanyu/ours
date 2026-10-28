import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
const keys = await subtle.generateKey(algorithm, true, ['sign', 'verify']);
const publicKey = await subtle.exportKey('jwk', keys.publicKey);
const privateKey = await subtle.exportKey('jwk', keys.privateKey);
const raw = new Uint8Array(await subtle.exportKey('raw', keys.publicKey));
const applicationServerKey = Buffer.from(raw).toString('base64url');

console.log('VAPID_PUBLIC_JWK=' + JSON.stringify(publicKey));
console.log('VAPID_PRIVATE_JWK=' + JSON.stringify(privateKey));
console.log('VAPID_PUBLIC_KEY=' + applicationServerKey);
console.log('\nSet VAPID_PUBLIC_KEY in cloud-config.js as vapidPublicKey.');
console.log('Store the two JWK values and OURS_PUSH_DISPATCH_SECRET as Supabase Edge Function secrets.');
