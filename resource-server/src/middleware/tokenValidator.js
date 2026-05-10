'use strict';
const axios = require('axios');

module.exports = async function tokenValidator(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Authorization header missing or not Bearer type'
      });
    }

    const token = authHeader.substring(7);
    if (!token) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token is empty'
      });
    }

    const params = new URLSearchParams();
    params.append('token', token);
    params.append('client_id', process.env.INTROSPECT_CLIENT_ID || 'resource-server-internal');
    params.append('client_secret', process.env.INTROSPECT_CLIENT_SECRET || 'resource-server-secret');

    const response = await axios.post(
      (process.env.AUTH_SERVER_URL || 'http://localhost:3001') + '/introspect',
      params.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000
      }
    );

    const data = response.data;
    if (!data.active) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'Token is inactive, expired, or revoked'
      });
    }

    req.tokenPayload = data;
    next();
  } catch (err) {
    console.error('[resource-server] tokenValidator error:', err.message);
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token validation failed'
    });
  }
};
