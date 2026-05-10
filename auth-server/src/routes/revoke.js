'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../models/db');
const { revokeToken } = require('../services/tokenService');

const router = express.Router();

router.post('/', function (req, res) {
  try {
    const client_id = req.body.client_id;
    const client_secret = req.body.client_secret;
    const token = req.body.token;
    const token_type_hint = req.body.token_type_hint || 'access_token';

    if (client_id && client_secret) {
      const client = db.findClient(client_id);
      if (!client || !bcrypt.compareSync(client_secret, client.client_secret_hash)) {
        return res.status(200).json({ message: 'ok' });
      }
    }

    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        const accessRow = db.findAccessToken(decoded.jti);
        if (accessRow) {
          db.deleteConsent(accessRow.user_id, accessRow.client_id);
        }
      } else {
        const tokenHash = require('../services/cryptoService').hashToken(token);
        const refreshRow = db.findRefreshToken(tokenHash);
        if (refreshRow) {
          db.deleteConsent(refreshRow.user_id, refreshRow.client_id);
        }
      }

      revokeToken(token, token_type_hint);
      db.auditLog(
        'TOKEN_REVOKED',
        null,
        client_id || null,
        req.ip,
        req.headers['user-agent'],
        true,
        null,
        { token_type_hint: token_type_hint }
      );
    }
  } catch (e) {
    console.error('[revoke] Error:', e.message);
  }

  return res.status(200).json({ message: 'ok' });
});

module.exports = router;
