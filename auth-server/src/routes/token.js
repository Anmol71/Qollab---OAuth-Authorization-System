'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../models/db');
const { validatePKCE } = require('../services/cryptoService');
const { createTokenPair, rotateRefreshToken } = require('../services/tokenService');
const { tokenLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.use(tokenLimiter);

function authenticateClient(body) {
  const client_id = body.client_id;
  const client_secret = body.client_secret;

  if (!client_id || !client_secret) {
    const e = new Error('Missing client credentials');
    e.code = 'MISSING_CLIENT_CREDENTIALS';
    throw e;
  }

  const client = db.findClient(client_id);
  if (!client) {
    const e2 = new Error('Unknown client');
    e2.code = 'INVALID_CLIENT';
    throw e2;
  }

  if (!bcrypt.compareSync(client_secret, client.client_secret_hash)) {
    const e3 = new Error('Invalid client secret');
    e3.code = 'INVALID_CLIENT_SECRET';
    throw e3;
  }

  return client;
}

function handleError(res, err) {
  const code = err.code || '';

  if (
    code === 'MISSING_CLIENT_CREDENTIALS' ||
    code === 'INVALID_CLIENT' ||
    code === 'INVALID_CLIENT_SECRET'
  ) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Client authentication failed' });
  }

  if (code === 'INVALID_GRANT') {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'The authorization code is invalid, expired, or already used'
    });
  }

  if (code === 'PKCE_FAILED') {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed: code_verifier does not match code_challenge'
    });
  }

  if (code === 'INVALID_REFRESH_TOKEN' || code === 'REFRESH_TOKEN_EXPIRED') {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Refresh token is invalid or expired'
    });
  }

  if (code === 'REFRESH_TOKEN_REUSE_DETECTED' || code === 'REFRESH_TOKEN_ALREADY_USED') {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Refresh token reuse detected - all tokens in this family have been revoked for security'
    });
  }

  if (code === 'CLIENT_MISMATCH') {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Token does not belong to this client' });
  }

  console.error('[token] Unhandled error:', err.message);
  return res.status(500).json({ error: 'server_error', error_description: 'An internal error occurred' });
}

router.post('/', function (req, res) {
  try {
    const grant_type = req.body.grant_type;

    if (grant_type === 'authorization_code') {
      const client = authenticateClient(req.body);
      const code = req.body.code;
      const redirect_uri = req.body.redirect_uri;
      const code_verifier = req.body.code_verifier;

      if (!code) {
        const e = new Error();
        e.code = 'INVALID_GRANT';
        throw e;
      }
      if (!code_verifier) {
        const e2 = new Error();
        e2.code = 'PKCE_FAILED';
        throw e2;
      }

      const storedCode = db.findAuthCode(code);
      if (!storedCode) {
        const e3 = new Error();
        e3.code = 'INVALID_GRANT';
        throw e3;
      }
      if (storedCode.used_at) {
        const e4 = new Error();
        e4.code = 'INVALID_GRANT';
        throw e4;
      }
      if (new Date(storedCode.expires_at) < new Date()) {
        const e5 = new Error();
        e5.code = 'INVALID_GRANT';
        throw e5;
      }
      if (storedCode.client_id !== client.client_id) {
        const e6 = new Error();
        e6.code = 'INVALID_GRANT';
        throw e6;
      }
      if (storedCode.redirect_uri !== redirect_uri) {
        const e7 = new Error();
        e7.code = 'INVALID_GRANT';
        throw e7;
      }
      if (!validatePKCE(code_verifier, storedCode.code_challenge)) {
        const e8 = new Error();
        e8.code = 'PKCE_FAILED';
        throw e8;
      }

      db.markAuthCodeUsed(code);
      const tokens = createTokenPair(storedCode.user_id, storedCode.client_id, storedCode.scope);
      db.auditLog(
        'TOKEN_ISSUED',
        storedCode.user_id,
        client.client_id,
        req.ip,
        req.headers['user-agent'],
        true,
        null,
        { scope: storedCode.scope, grant_type: 'authorization_code' }
      );

      return res.json({
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope
      });
    }

    if (grant_type === 'refresh_token') {
      const client2 = authenticateClient(req.body);
      const refresh_token = req.body.refresh_token;

      if (!refresh_token) {
        const e9 = new Error();
        e9.code = 'INVALID_REFRESH_TOKEN';
        throw e9;
      }

      const newTokens = rotateRefreshToken(refresh_token, client2.client_id);
      db.auditLog('TOKEN_REFRESHED', null, client2.client_id, req.ip, req.headers['user-agent'], true, null, null);

      return res.json({
        access_token: newTokens.accessToken,
        token_type: 'Bearer',
        expires_in: newTokens.expiresIn,
        refresh_token: newTokens.refreshToken,
        scope: newTokens.scope
      });
    }

    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'grant_type must be authorization_code or refresh_token'
    });
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
