'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'client-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, secure: false, maxAge: 86400000 }
  })
);

app.use('/', require('./src/routes'));

app.get('/health', function (req, res) {
  res.json({ status: 'ok', service: 'client-app' });
});

app.use(function (err, req, res, next) {
  console.error('[client-app] Error:', err.message);
  res.status(500).json({ error: 'server_error' });
});

const PORT = parseInt(process.env.PORT, 10) || 3003;
app.listen(PORT, function () {
  console.log('[client-app] Running on http://localhost:' + PORT);
});
