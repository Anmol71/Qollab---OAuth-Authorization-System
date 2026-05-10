'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, '../../keys');

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateRSAKeyPair() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  const privatePath = path.join(KEYS_DIR, 'private.pem');
  const publicPath = path.join(KEYS_DIR, 'public.pem');

  if (!fs.existsSync(privatePath) || !fs.existsSync(publicPath)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
    fs.writeFileSync(publicPath, publicKey, { mode: 0o644 });
    console.log('[crypto] RSA-2048 key pair generated in', KEYS_DIR);
  }

  return {
    privateKey: fs.readFileSync(privatePath, 'utf8'),
    publicKey: fs.readFileSync(publicPath, 'utf8')
  };
}

function generateCodeVerifier() {
  return base64url(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function validatePKCE(verifier, storedChallenge) {
  const computed = generateCodeChallenge(verifier);
  return computed === storedChallenge;
}

function generateSecureToken(bytes) {
  bytes = bytes || 32;
  return crypto.randomBytes(bytes).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  generateRSAKeyPair,
  generateCodeVerifier,
  generateCodeChallenge,
  validatePKCE,
  generateSecureToken,
  hashToken,
  base64url
};
