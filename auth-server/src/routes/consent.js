'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../models/db');
const { introspectToken } = require('../services/tokenService');

const router = express.Router();

router.post('/revoke', function (req, res) {
  try {
    const client_id = req.body.client_id;
    const client_secret = req.body.client_secret;
    const access_token = req.body.access_token;
    const target_client_id = req.body.target_client_id;

    if (!client_id || !client_secret || !access_token || !target_client_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id, client_secret, access_token, and target_client_id are required'
      });
    }

    const client = db.findClient(client_id);
    if (!client || !bcrypt.compareSync(client_secret, client.client_secret_hash)) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    const tokenInfo = introspectToken(access_token);
    if (!tokenInfo.active || !tokenInfo.sub) {
      return res.status(400).json({
        error: 'invalid_token',
        error_description: 'Access token is not active'
      });
    }

    db.deleteConsent(tokenInfo.sub, target_client_id);
    db.auditLog(
      'CONSENT_REVOKED',
      tokenInfo.sub,
      target_client_id,
      req.ip,
      req.headers['user-agent'],
      true,
      null,
      { revoked_by_client: client_id }
    );

    return res.json({ message: 'Consent revoked' });
  } catch (e) {
    console.error('[consent revoke] Error:', e.message);
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

module.exports = router;