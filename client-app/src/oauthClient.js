'use strict';
require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:3001';
const RESOURCE_SERVER_URL = process.env.RESOURCE_SERVER_URL || 'http://localhost:3002';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3003/callback';

const CLIENT_PROFILES = {
  default: {
    key: 'default',
    label: 'Test Client',
    clientId: process.env.CLIENT_ID || 'test-client-001',
    clientSecret: process.env.CLIENT_SECRET || 'super-secret-key',
    scope: 'profile wishlist orders account contacts'
  },
  amazon: {
    key: 'amazon',
    label: 'Amazon',
    clientId: process.env.AMAZON_CLIENT_ID || 'amazon-client-001',
    clientSecret: process.env.AMAZON_CLIENT_SECRET || 'amazon-super-secret',
    scope: 'profile wishlist orders account contacts'
  },
  flipkart: {
    key: 'flipkart',
    label: 'Flipkart',
    clientId: process.env.FLIPKART_CLIENT_ID || 'flipkart-client-001',
    clientSecret: process.env.FLIPKART_CLIENT_SECRET || 'flipkart-super-secret',
    scope: 'profile wishlist orders account contacts'
  }
};

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateCodeVerifier() {
  return base64url(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

function generateState() {
  return base64url(crypto.randomBytes(16));
}

function getClientProfile(key) {
  if (!key) {
    return CLIENT_PROFILES.default;
  }
  return CLIENT_PROFILES[key] || CLIENT_PROFILES.default;
}

function buildAuthorizationUrl(session, clientKey) {
  const profile = getClientProfile(clientKey);
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const state = generateState();

  session.pkceVerifier = verifier;
  session.oauthState = state;
  session.oauthClientProfileKey = profile.key;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: profile.clientId,
    redirect_uri: REDIRECT_URI,
    scope: profile.scope,
    state: state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  const url = AUTH_SERVER_URL + '/authorize?' + params.toString();
  return {
    url: url,
    state: state,
    verifier: verifier,
    clientKey: profile.key,
    clientLabel: profile.label,
    clientId: profile.clientId
  };
}

async function exchangeCodeForTokens(code, codeVerifier, clientProfile) {
  const profile = clientProfile || CLIENT_PROFILES.default;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    client_id: profile.clientId,
    client_secret: profile.clientSecret,
    code_verifier: codeVerifier
  });

  const response = await axios.post(AUTH_SERVER_URL + '/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data;
}

async function refreshAccessToken(refreshToken, clientProfile) {
  const profile = clientProfile || CLIENT_PROFILES.default;
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: profile.clientId,
    client_secret: profile.clientSecret
  });

  const response = await axios.post(AUTH_SERVER_URL + '/token', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data;
}

async function revokeToken(token, tokenTypeHint, clientProfile) {
  const profile = clientProfile || CLIENT_PROFILES.default;
  const params = new URLSearchParams({
    token: token,
    token_type_hint: tokenTypeHint || 'access_token',
    client_id: profile.clientId,
    client_secret: profile.clientSecret
  });

  const response = await axios.post(AUTH_SERVER_URL + '/revoke', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data;
}

async function revokeConsent(accessToken, clientId, clientProfile) {
  const profile = clientProfile || CLIENT_PROFILES.default;
  const params = new URLSearchParams({
    access_token: accessToken,
    client_id: profile.clientId,
    client_secret: profile.clientSecret,
    target_client_id: clientId
  });

  const response = await axios.post(AUTH_SERVER_URL + '/consent/revoke', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data;
}

async function callAPI(endpoint, accessToken) {
  const response = await axios.get(RESOURCE_SERVER_URL + endpoint, {
    headers: { Authorization: 'Bearer ' + accessToken }
  });

  return response.data;
}

module.exports = {
  getClientProfile,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  revokeConsent,
  callAPI
};
