'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(
  cors({
    origin: ['http://localhost:3003', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type']
  })
);

app.use(express.json());
app.use('/api', require('./src/routes/api'));

app.get('/health', function (req, res) {
  res.json({ status: 'ok', service: 'resource-server' });
});

app.use(function (err, req, res, next) {
  console.error('[resource-server] Error:', err.message);
  res.status(500).json({ error: 'server_error' });
});

const PORT = parseInt(process.env.PORT, 10) || 3002;
app.listen(PORT, function () {
  console.log('[resource-server] Running on http://localhost:' + PORT);
});
