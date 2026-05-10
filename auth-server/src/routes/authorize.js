'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../models/db');
const { generateSecureToken } = require('../services/cryptoService');
const requireSession = require('../middleware/requireSession');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

const SCOPE_DESCRIPTIONS = {
  profile: 'Your name and basic profile information',
  wishlist: 'Your saved items and wishlists',
  orders: 'Your order history and details',
  account: 'Your account settings and preferences',
  contacts: 'Your contacts list',
  introspect: 'Token introspection (internal)'
};

function buildScopeDescriptions(scopes) {
  const result = {};
  scopes.forEach(function (s) {
    result[s] = SCOPE_DESCRIPTIONS[s] || s;
  });
  return result;
}

function issueAuthCode(userId, clientId, redirectUri, scope, state, codeChallenge) {
  const code = generateSecureToken(16);
  const ttl = parseInt(process.env.AUTH_CODE_TTL_SECONDS, 10) || 600;
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  db.insertAuthCode(code, clientId, userId, redirectUri, scope, expiresAt, codeChallenge);
  db.auditLog('AUTH_CODE_ISSUED', userId, clientId, null, null, true, null, { scope: scope });
  return code;
}

router.get('/', function (req, res) {
  try {
    const response_type = req.query.response_type;
    const client_id = req.query.client_id;
    const redirect_uri = req.query.redirect_uri;
    const scope = req.query.scope;
    const state = req.query.state;
    const code_challenge = req.query.code_challenge;

    if (response_type !== 'code') {
      return res.status(400).json({
        error: 'unsupported_response_type',
        error_description: 'Only response_type=code is supported'
      });
    }

    if (!client_id) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'client_id is required' });
    }
    if (!redirect_uri) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri is required' });
    }
    if (!scope) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'scope is required' });
    }
    if (!state) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'state is required' });
    }
    if (!code_challenge) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'code_challenge is required (PKCE is mandatory)'
      });
    }

    const client = db.findClient(client_id);
    if (!client) {
      return res.status(401).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
    }

    const registeredUris = JSON.parse(client.redirect_uris);
    if (!registeredUris.includes(redirect_uri)) {
      return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: 'redirect_uri does not match registered URIs'
      });
    }

    const requestedScopes = scope.split(' ');
    const allowedScopes = client.allowed_scopes.split(' ');
    const invalidScopes = requestedScopes.filter(function (s) {
      return !allowedScopes.includes(s);
    });

    if (invalidScopes.length > 0) {
      return res.redirect(
        redirect_uri +
          '?error=invalid_scope&error_description=Scope+not+allowed&state=' +
          encodeURIComponent(state)
      );
    }

    req.session.oauthParams = {
      client_id: client_id,
      redirect_uri: redirect_uri,
      scope: scope,
      state: state,
      code_challenge: code_challenge
    };

    if (req.session.userId) {
      const consent = db.findConsent(req.session.userId, client_id);
      if (consent) {
        const grantedScopes = consent.granted_scopes.split(' ');
        const allCovered = requestedScopes.every(function (s) {
          return grantedScopes.includes(s);
        });

        if (allCovered) {
          const code = issueAuthCode(
            req.session.userId,
            client_id,
            redirect_uri,
            scope,
            state,
            code_challenge
          );
          return res.json({
            action: 'redirect',
            redirect_to: redirect_uri + '?code=' + code + '&state=' + encodeURIComponent(state)
          });
        }
      }

      return res.json({
        action: 'consent_required',
        client_name: client.name,
        requested_scopes: requestedScopes,
        scope_descriptions: buildScopeDescriptions(requestedScopes),
        user_name: req.session.userName || 'User'
      });
    }

    return res.json({
      action: 'login_required',
      client_name: client.name,
      requested_scopes: requestedScopes,
      scope_descriptions: buildScopeDescriptions(requestedScopes)
    });
  } catch (err) {
    console.error('[authorize GET] Error:', err.message);
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

router.post('/login', loginLimiter, function (req, res) {
  try {
    const email = req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'email and password are required'
      });
    }

    const oauthParams = req.session.oauthParams;
    if (!oauthParams) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'No authorization session found. Please start the OAuth flow again.'
      });
    }

    const user = db.findUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      db.auditLog(
        'USER_LOGIN_FAILURE',
        null,
        oauthParams.client_id,
        req.ip,
        req.headers['user-agent'],
        false,
        'Invalid credentials',
        null
      );

      return res.status(401).json({
        error: 'invalid_credentials',
        error_description: 'Invalid email or password'
      });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userName = user.name;

    db.auditLog(
      'USER_LOGIN_SUCCESS',
      user.id,
      oauthParams.client_id,
      req.ip,
      req.headers['user-agent'],
      true,
      null,
      null
    );

    const consent = db.findConsent(user.id, oauthParams.client_id);
    if (consent) {
      const requestedScopes = oauthParams.scope.split(' ');
      const grantedScopes = consent.granted_scopes.split(' ');
      const allCovered = requestedScopes.every(function (s) {
        return grantedScopes.includes(s);
      });

      if (allCovered) {
        const code = issueAuthCode(
          user.id,
          oauthParams.client_id,
          oauthParams.redirect_uri,
          oauthParams.scope,
          oauthParams.state,
          oauthParams.code_challenge
        );

        return res.json({
          action: 'redirect',
          redirect_to:
            oauthParams.redirect_uri + '?code=' + code + '&state=' + encodeURIComponent(oauthParams.state)
        });
      }
    }

    const client = db.findClient(oauthParams.client_id);
    const requestedScopesArr = oauthParams.scope.split(' ');

    return res.json({
      action: 'consent_required',
      client_name: client ? client.name : oauthParams.client_id,
      requested_scopes: requestedScopesArr,
      scope_descriptions: buildScopeDescriptions(requestedScopesArr),
      user_name: user.name
    });
  } catch (err) {
    console.error('[authorize POST /login] Error:', err.message);
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

router.post('/consent', requireSession, function (req, res) {
  try {
    const approved = req.body.approved;
    const selected_scopes = req.body.selected_scopes;
    const oauthParams = req.session.oauthParams;

    if (!oauthParams) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'No authorization session found. Please start the OAuth flow again.'
      });
    }

    const client_id = oauthParams.client_id;
    const redirect_uri = oauthParams.redirect_uri;
    const requestedScope = oauthParams.scope;
    const state = oauthParams.state;
    const code_challenge = oauthParams.code_challenge;
    const isApproved = approved === true || approved === 'true' || approved === '1';

    if (!isApproved) {
      db.auditLog(
        'CONSENT_DENIED',
        req.session.userId,
        client_id,
        req.ip,
        req.headers['user-agent'],
        false,
        'User denied consent',
        null
      );

      delete req.session.oauthParams;

      return res.json({
        action: 'redirect',
        redirect_to:
          redirect_uri +
          '?error=access_denied&error_description=User+denied+access&state=' +
          encodeURIComponent(state)
      });
    }

    const requestedScopes = requestedScope.split(' ');
    let selectedScopesList = [];

    if (Array.isArray(selected_scopes)) {
      selectedScopesList = selected_scopes;
    } else if (typeof selected_scopes === 'string' && selected_scopes.trim()) {
      selectedScopesList = selected_scopes.split(' ');
    }

    if (selectedScopesList.length === 0) {
      selectedScopesList = requestedScopes;
    }

    selectedScopesList = Array.from(
      new Set(
        selectedScopesList
          .map(function (s) {
            return String(s || '').trim();
          })
          .filter(function (s) {
            return s.length > 0 && requestedScopes.includes(s);
          })
      )
    );

    if (selectedScopesList.length === 0) {
      db.auditLog('CONSENT_DENIED_NO_SCOPE', req.session.userId, client_id, req.ip, req.headers['user-agent'], false, 'No scopes selected', null);
      delete req.session.oauthParams;
      return res.json({
        action: 'redirect',
        redirect_to:
          redirect_uri +
          '?error=access_denied&error_description=No+scopes+approved&state=' +
          encodeURIComponent(state)
      });
    }

    const grantedScope = selectedScopesList.join(' ');

    db.upsertConsent(req.session.userId, client_id, grantedScope);
    db.auditLog(
      'CONSENT_GRANTED',
      req.session.userId,
      client_id,
      req.ip,
      req.headers['user-agent'],
      true,
      null,
      { requested_scope: requestedScope, granted_scope: grantedScope }
    );

    const code = issueAuthCode(req.session.userId, client_id, redirect_uri, grantedScope, state, code_challenge);
    delete req.session.oauthParams;

    return res.json({
      action: 'redirect',
      redirect_to: redirect_uri + '?code=' + code + '&state=' + encodeURIComponent(state)
    });
  } catch (err) {
    console.error('[authorize POST /consent] Error:', err.message);
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

module.exports = router;
