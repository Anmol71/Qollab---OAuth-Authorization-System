'use strict';
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cryptoService = require('./cryptoService');
const { db } = require('../models/db');

require('dotenv').config();

let _keys = null;

function getKeys() {
  if (!_keys) {
    _keys = cryptoService.generateRSAKeyPair();
  }
  return _keys;
}

function createTokenPair(userId, clientId, scope, familyId) {
  const keys = getKeys();
  const family = familyId || uuidv4();
  const atTTL = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS, 10) || 900;
  const rtTTL = parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS, 10) || 604800;
  const user = db.findUserById(userId);

  const jti = uuidv4();
  const accessToken = jwt.sign(
    {
      sub: userId,
      client_id: clientId,
      scope: scope,
      jti: jti,
      name: user ? user.name : null,
      email: user ? user.email : null
    },
    keys.privateKey,
    {
      algorithm: 'RS256',
      issuer: process.env.JWT_ISSUER || 'http://localhost:3001',
      audience: process.env.JWT_AUDIENCE || 'http://localhost:3002',
      expiresIn: atTTL
    }
  );

  const atExpiry = new Date(Date.now() + atTTL * 1000).toISOString();
  db.insertAccessToken(jti, userId, clientId, scope, atExpiry);

  const rtId = uuidv4();
  const rtValue = cryptoService.generateSecureToken(32);
  const rtHash = cryptoService.hashToken(rtValue);
  const rtExpiry = new Date(Date.now() + rtTTL * 1000).toISOString();
  db.insertRefreshToken(rtId, rtHash, family, userId, clientId, scope, rtExpiry);

  return {
    accessToken: accessToken,
    accessTokenJti: jti,
    refreshToken: rtValue,
    expiresIn: atTTL,
    scope: scope
  };
}

function verifyAccessToken(token) {
  const keys = getKeys();
  const decoded = jwt.verify(token, keys.publicKey, {
    algorithms: ['RS256'],
    issuer: process.env.JWT_ISSUER || 'http://localhost:3001',
    audience: process.env.JWT_AUDIENCE || 'http://localhost:3002'
  });

  const stored = db.findAccessToken(decoded.jti);
  if (!stored) {
    const err = new Error('Token not found in database');
    err.code = 'TOKEN_NOT_FOUND';
    throw err;
  }

  if (stored.revoked_at) {
    const rErr = new Error('Token has been revoked');
    rErr.code = 'TOKEN_REVOKED';
    throw rErr;
  }

  return decoded;
}

function rotateRefreshToken(refreshTokenValue, clientId) {
  const tokenHash = cryptoService.hashToken(refreshTokenValue);
  const stored = db.findRefreshToken(tokenHash);

  if (!stored) {
    const e1 = new Error('Refresh token not found');
    e1.code = 'INVALID_REFRESH_TOKEN';
    throw e1;
  }

  if (stored.revoked_at) {
    db.revokeFamilyTokens(stored.family_id);
    const e2 = new Error('Refresh token reuse detected');
    e2.code = 'REFRESH_TOKEN_REUSE_DETECTED';
    throw e2;
  }

  if (stored.used_at) {
    db.revokeFamilyTokens(stored.family_id);
    const e3 = new Error('Refresh token already used');
    e3.code = 'REFRESH_TOKEN_ALREADY_USED';
    throw e3;
  }

  if (stored.client_id !== clientId) {
    const e4 = new Error('Client mismatch');
    e4.code = 'CLIENT_MISMATCH';
    throw e4;
  }

  if (new Date(stored.expires_at) < new Date()) {
    const e5 = new Error('Refresh token expired');
    e5.code = 'REFRESH_TOKEN_EXPIRED';
    throw e5;
  }

  const newPair = createTokenPair(stored.user_id, stored.client_id, stored.scope, stored.family_id);
  db.markRefreshTokenUsed(stored.id, newPair.accessTokenJti);
  return newPair;
}

function revokeToken(tokenValue, tokenTypeHint) {
  if (tokenTypeHint === 'refresh_token') {
    const rtHash = cryptoService.hashToken(tokenValue);
    const rt = db.findRefreshToken(rtHash);
    if (rt) {
      db.revokeFamilyTokens(rt.family_id);
    }
  } else if (tokenTypeHint === 'access_token') {
    const decoded = jwt.decode(tokenValue);
    if (decoded && decoded.jti) {
      db.revokeAccessToken(decoded.jti);
    }
  } else {
    const decoded2 = jwt.decode(tokenValue);
    if (decoded2 && decoded2.jti) {
      db.revokeAccessToken(decoded2.jti);
    } else {
      const rtHash2 = cryptoService.hashToken(tokenValue);
      const rt2 = db.findRefreshToken(rtHash2);
      if (rt2) {
        db.revokeFamilyTokens(rt2.family_id);
      }
    }
  }

  return true;
}

function introspectToken(token) {
  try {
    const decoded = verifyAccessToken(token);
    return {
      active: true,
      sub: decoded.sub,
      client_id: decoded.client_id,
      scope: decoded.scope,
      name: decoded.name,
      email: decoded.email,
      exp: decoded.exp,
      iat: decoded.iat,
      jti: decoded.jti,
      iss: decoded.iss,
      token_type: 'Bearer'
    };
  } catch (e) {
    return { active: false };
  }
}

module.exports = {
  createTokenPair,
  verifyAccessToken,
  rotateRefreshToken,
  revokeToken,
  introspectToken
};
