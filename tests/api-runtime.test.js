import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

test('API functions load without CommonJS-to-ESM require support', async () => {
  for (const path of ['sms/send', 'sms/inbound', 'sms/status', 'cron/reminders', 'digest']) {
    const module = await import(`../api/${path}.js`);
    assert.equal(typeof module.default, 'function');
  }
});

test('Firebase JWKS dependency converts an RSA key that verifies its signature', async () => {
  const require = createRequire(import.meta.url);
  const jwksClient = require('jwks-rsa');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'runtime-test', use: 'sig', alg: 'RS256' };
  const client = jwksClient({ jwksUri: 'https://unused.invalid/keys' });
  client.getKeys = async () => [jwk];
  const [key] = await client.getSigningKeys();
  assert.equal(key.kid, jwk.kid);
  const payload = Buffer.from('Firebase runtime compatibility test');
  const signature = sign('RSA-SHA256', payload, privateKey);
  assert.equal(verify('RSA-SHA256', payload, key.getPublicKey(), signature), true);
  assert.equal(verify('RSA-SHA256', Buffer.from('tampered'), key.getPublicKey(), signature), false);
});
