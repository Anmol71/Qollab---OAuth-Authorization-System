'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../models/db');
const { introspectToken } = require('../services/tokenService');

const router = express.Router();

router.post('/', function (req, res) {
  try {
    const client_id = req.body.client_id;
    const client_secret = req.body.client_secret;
    const token = req.body.token;

    if (!client_id || !client_secret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client credentials required'
      });
    }

    const client = db.findClient(client_id);
    if (!client || !bcrypt.compareSync(client_secret, client.client_secret_hash)) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    if (!token) {
      return res.json({ active: false });
    }

    const result = introspectToken(token);
    return res.json(result);
  } catch (e) {
    console.error('[introspect] Error:', e.message);
    return res.json({ active: false });
  }
});

module.exports = router;
