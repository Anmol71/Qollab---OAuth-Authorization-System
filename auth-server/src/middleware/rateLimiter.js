'use strict';
const rateLimit = require('express-rate-limit');

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'too_many_requests',
    error_description: 'Too many requests, please try again later'
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'too_many_requests',
    error_description: 'Too many login attempts, please try again later'
  }
});

module.exports = { tokenLimiter, loginLimiter };
