'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const { initDatabase, db } = require('./src/models/db');

initDatabase();

const app = express();

app.use(
  cors({
    origin: ['http://localhost:3003', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

app.use('/authorize', require('./src/routes/authorize'));
app.use('/token', require('./src/routes/token'));
app.use('/revoke', require('./src/routes/revoke'));
app.use('/introspect', require('./src/routes/introspect'));

app.get('/health', function (req, res) {
  res.json({
    status: 'ok',
    service: 'auth-server',
    timestamp: new Date().toISOString()
  });
});

app.get('/audit-logs', function (req, res) {
  try {
    const logs = db.getRecentAuditLogs(50);
    res.json({ logs: logs });
  } catch (e) {
    res.json({ logs: [] });
  }
});

app.use(function (err, req, res, next) {
  console.error('[auth-server] Unhandled error:', err.message);
  res.status(500).json({
    error: 'server_error',
    error_description: 'An internal error occurred'
  });
});

const PORT = parseInt(process.env.PORT, 10) || 3001;
app.listen(PORT, function () {
  console.log('[auth-server] Running on http://localhost:' + PORT);
  console.log('[auth-server] Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('[auth-server] Test users: alice@example.com / password123, bob@example.com / password456');
});
