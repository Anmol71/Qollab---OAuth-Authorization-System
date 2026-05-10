'use strict';
const express = require('express');
const oauthClient = require('./oauthClient');

const router = express.Router();

router.get('/', function (req, res) {
  if (req.session && req.session.tokens) {
    res.json({
      authenticated: true,
      message: 'You are logged in via OAuth 2.0',
      links: {
        dashboard: '/dashboard',
        logout: '/logout',
        profile: '/api-demo/profile',
        wishlist: '/api-demo/wishlist',
        orders: '/api-demo/orders',
        account: '/api-demo/account',
        contacts: '/api-demo/contacts'
      }
    });
  } else {
    res.json({
      authenticated: false,
      message: 'Not authenticated. Visit /login to start OAuth flow.',
      links: {
        login: '/login',
        login_amazon: '/login?app=amazon',
        login_flipkart: '/login?app=flipkart'
      }
    });
  }
});

router.get('/login', function (req, res) {
  const appKey = (req.query.app || 'default').toString().toLowerCase();
  const result = oauthClient.buildAuthorizationUrl(req.session, appKey);
  res.cookie(
    'oauth_flow',
    JSON.stringify({
      state: result.state,
      verifier: req.session.pkceVerifier,
      clientKey: result.clientKey
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 10 * 60 * 1000
    }
  );
  res.redirect('http://localhost:5173/login?' + new URLSearchParams({ auth_url: result.url }).toString());
});

router.get('/callback', async function (req, res) {
  try {
    const code = req.query.code;
    const state = req.query.state;
    const error = req.query.error;
    let flowState = req.session ? req.session.oauthState : null;
    let flowVerifier = req.session ? req.session.pkceVerifier : null;
    let flowClientKey = req.session ? req.session.oauthClientProfileKey : null;

    if ((!flowState || !flowVerifier) && req.cookies && req.cookies.oauth_flow) {
      try {
        const flowCookie = JSON.parse(req.cookies.oauth_flow);
        flowState = flowState || flowCookie.state;
        flowVerifier = flowVerifier || flowCookie.verifier;
        flowClientKey = flowClientKey || flowCookie.clientKey;
      } catch (cookieErr) {}
    }

    if (error) {
      res.clearCookie('oauth_flow');
      return res.redirect('http://localhost:5173/login?error=' + encodeURIComponent(error));
    }

    if (!code) {
      return res.redirect('http://localhost:5173/login?error=missing_code');
    }

    if (!flowState || !flowVerifier || state !== flowState) {
      res.clearCookie('oauth_flow');
      return res.redirect('http://localhost:5173/login?error=state_mismatch');
    }

    const profile = oauthClient.getClientProfile(flowClientKey);
    const tokens = await oauthClient.exchangeCodeForTokens(code, flowVerifier, profile);
    req.session.tokens = tokens;
    req.session.tokenReceivedAt = Date.now();
    req.session.oauthClientProfileKey = profile.key;
    req.session.oauthClientLabel = profile.label;
    req.session.oauthClientId = profile.clientId;
    delete req.session.pkceVerifier;
    delete req.session.oauthState;
    res.clearCookie('oauth_flow');

    res.redirect('http://localhost:5173/dashboard');
  } catch (err) {
    console.error(
      '[client-app] callback error:',
      err.response ? JSON.stringify(err.response.data) : err.message
    );
    res.clearCookie('oauth_flow');
    res.redirect('http://localhost:5173/login?error=callback_failed');
  }
});

router.get('/dashboard', function (req, res) {
  if (!req.session || !req.session.tokens) {
    return res.status(401).json({ error: 'not_authenticated' });
  }

  res.json({
    client: {
      key: req.session.oauthClientProfileKey || 'default',
      label: req.session.oauthClientLabel || 'Test Client',
      client_id: req.session.oauthClientId || null
    },
    tokens: {
      access_token: req.session.tokens.access_token,
      token_type: req.session.tokens.token_type,
      expires_in: req.session.tokens.expires_in,
      scope: req.session.tokens.scope,
      has_refresh_token: !!req.session.tokens.refresh_token
    },
    received_at: req.session.tokenReceivedAt
  });
});

async function callAPIWithRefresh(req, endpoint) {
  if (!req.session || !req.session.tokens) {
    const e = new Error('not_authenticated');
    e.status = 401;
    throw e;
  }

  const profile = oauthClient.getClientProfile(req.session.oauthClientProfileKey);

  try {
    return await oauthClient.callAPI(endpoint, req.session.tokens.access_token);
  } catch (err) {
    if (err.response && err.response.status === 401 && req.session.tokens.refresh_token) {
      const newTokens = await oauthClient.refreshAccessToken(req.session.tokens.refresh_token, profile);
      req.session.tokens = newTokens;
      return await oauthClient.callAPI(endpoint, req.session.tokens.access_token);
    }
    throw err;
  }
}

router.get('/api-demo/profile', async function (req, res) {
  try {
    const data = await callAPIWithRefresh(req, '/api/profile');
    res.json(data);
  } catch (err) {
    const status = err.response ? err.response.status : err.status || 500;
    const data2 = err.response ? err.response.data : { error: err.message };
    res.status(status).json(data2);
  }
});

router.get('/api-demo/emails', async function (req, res) {
  return res.status(404).json({ error: 'email scope has been replaced with wishlist, orders, and account' });
});

router.get('/api-demo/wishlist', async function (req, res) {
  try {
    const data = await callAPIWithRefresh(req, '/api/wishlist');
    res.json(data);
  } catch (err) {
    const status = err.response ? err.response.status : err.status || 500;
    const data2 = err.response ? err.response.data : { error: err.message };
    res.status(status).json(data2);
  }
});

router.get('/api-demo/orders', async function (req, res) {
  try {
    const data = await callAPIWithRefresh(req, '/api/orders');
    res.json(data);
  } catch (err) {
    const status = err.response ? err.response.status : err.status || 500;
    const data2 = err.response ? err.response.data : { error: err.message };
    res.status(status).json(data2);
  }
});

router.get('/api-demo/account', async function (req, res) {
  try {
    const data = await callAPIWithRefresh(req, '/api/account');
    res.json(data);
  } catch (err) {
    const status = err.response ? err.response.status : err.status || 500;
    const data2 = err.response ? err.response.data : { error: err.message };
    res.status(status).json(data2);
  }
});

router.get('/api-demo/contacts', async function (req, res) {
  try {
    const data = await callAPIWithRefresh(req, '/api/contacts');
    res.json(data);
  } catch (err) {
    const status = err.response ? err.response.status : err.status || 500;
    const data2 = err.response ? err.response.data : { error: err.message };
    res.status(status).json(data2);
  }
});

router.get('/logout', async function (req, res) {
  const profile = oauthClient.getClientProfile(req.session ? req.session.oauthClientProfileKey : null);
  if (req.session && req.session.tokens) {
    try {
      await oauthClient.revokeToken(req.session.tokens.access_token, 'access_token', profile);
    } catch (e) {}

    try {
      await oauthClient.revokeToken(req.session.tokens.refresh_token, 'refresh_token', profile);
    } catch (e) {}
  }

  req.session.destroy(function () {
    res.json({ message: 'Logged out and all tokens revoked' });
  });
});

module.exports = router;
