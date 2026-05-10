'use strict';
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { Database } = require('node-sqlite3-wasm');

require('dotenv').config();

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.cwd(), process.env.DB_PATH)
  : path.join(process.cwd(), 'database', 'oauth.db');

let _db = null;

function initDatabase() {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  console.log('[db] Opened database at', DB_PATH);

  createTables();
  seedData();

  process.on('exit', function () {
    if (_db) {
      try {
        _db.close();
      } catch (e) {}
    }
  });

  process.on('SIGINT', function () {
    if (_db) {
      try {
        _db.close();
      } catch (e) {}
    }
    process.exit(0);
  });

  process.on('SIGTERM', function () {
    if (_db) {
      try {
        _db.close();
      } catch (e) {}
    }
    process.exit(0);
  });

  return _db;
}

function createTables() {
  _db.exec(
    [
      'CREATE TABLE IF NOT EXISTS users (',
      '  id TEXT PRIMARY KEY,',
      '  email TEXT UNIQUE NOT NULL,',
      '  password_hash TEXT NOT NULL,',
      '  name TEXT NOT NULL,',
      '  is_active INTEGER DEFAULT 1,',
      "  created_at TEXT DEFAULT (datetime('now'))",
      ');',
      'CREATE TABLE IF NOT EXISTS clients (',
      '  client_id TEXT PRIMARY KEY,',
      '  client_secret_hash TEXT NOT NULL,',
      '  name TEXT NOT NULL,',
      '  redirect_uris TEXT NOT NULL,',
      '  allowed_scopes TEXT NOT NULL,',
      "  grant_types TEXT DEFAULT 'authorization_code refresh_token',",
      '  is_active INTEGER DEFAULT 1,',
      "  created_at TEXT DEFAULT (datetime('now'))",
      ');',
      'CREATE TABLE IF NOT EXISTS auth_codes (',
      '  code TEXT PRIMARY KEY,',
      '  client_id TEXT NOT NULL,',
      '  user_id TEXT NOT NULL,',
      '  redirect_uri TEXT NOT NULL,',
      '  scope TEXT NOT NULL,',
      '  expires_at TEXT NOT NULL,',
      '  used_at TEXT,',
      '  code_challenge TEXT NOT NULL,',
      "  created_at TEXT DEFAULT (datetime('now'))",
      ');',
      'CREATE TABLE IF NOT EXISTS access_tokens (',
      '  jti TEXT PRIMARY KEY,',
      '  user_id TEXT NOT NULL,',
      '  client_id TEXT NOT NULL,',
      '  scope TEXT NOT NULL,',
      '  expires_at TEXT NOT NULL,',
      '  revoked_at TEXT,',
      "  created_at TEXT DEFAULT (datetime('now'))",
      ');',
      'CREATE TABLE IF NOT EXISTS refresh_tokens (',
      '  id TEXT PRIMARY KEY,',
      '  token_hash TEXT UNIQUE NOT NULL,',
      '  family_id TEXT NOT NULL,',
      '  user_id TEXT NOT NULL,',
      '  client_id TEXT NOT NULL,',
      '  scope TEXT NOT NULL,',
      '  expires_at TEXT NOT NULL,',
      '  used_at TEXT,',
      '  revoked_at TEXT,',
      '  replaced_by TEXT,',
      "  created_at TEXT DEFAULT (datetime('now'))",
      ');',
      'CREATE TABLE IF NOT EXISTS consents (',
      '  id TEXT PRIMARY KEY,',
      '  user_id TEXT NOT NULL,',
      '  client_id TEXT NOT NULL,',
      '  granted_scopes TEXT NOT NULL,',
      "  granted_at TEXT DEFAULT (datetime('now')),",
      '  UNIQUE(user_id, client_id)',
      ');',
      'CREATE TABLE IF NOT EXISTS audit_logs (',
      '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
      '  event_type TEXT NOT NULL,',
      '  user_id TEXT,',
      '  client_id TEXT,',
      '  ip_address TEXT,',
      '  user_agent TEXT,',
      '  success INTEGER DEFAULT 1,',
      '  error_message TEXT,',
      '  metadata TEXT,',
      "  created_at TEXT DEFAULT (datetime('now'))",
      ');'
    ].join('\n')
  );

  console.log('[db] Tables created or verified');
}

function seedData() {
  const row = _db.get('SELECT COUNT(*) as count FROM users');
  if (!row || row.count === 0) {
    const aliceHash = bcrypt.hashSync('password123', 10);
    const bobHash = bcrypt.hashSync('password456', 10);

    _db.run('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [
      uuidv4(),
      'alice@example.com',
      aliceHash,
      'Alice Smith'
    ]);

    _db.run('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [
      uuidv4(),
      'bob@example.com',
      bobHash,
      'Bob Jones'
    ]);
  }

  ensureClient(
    'test-client-001',
    'super-secret-key',
    'Test Client Application',
    JSON.stringify(['http://localhost:3003/callback']),
    'profile wishlist orders account contacts',
    'authorization_code refresh_token'
  );

  ensureClient(
    'amazon-client-001',
    'amazon-super-secret',
    'Amazon Shopping',
    JSON.stringify(['http://localhost:3003/callback']),
    'profile wishlist orders account contacts',
    'authorization_code refresh_token'
  );

  ensureClient(
    'flipkart-client-001',
    'flipkart-super-secret',
    'Flipkart Marketplace',
    JSON.stringify(['http://localhost:3003/callback']),
    'profile wishlist orders account contacts',
    'authorization_code refresh_token'
  );

  ensureClient(
    'resource-server-internal',
    'resource-server-secret',
    'Resource Server Internal Client',
    JSON.stringify(['http://localhost:3002']),
    'introspect',
    'client_credentials'
  );

  console.log('[db] Seed data inserted or verified successfully');
}

function ensureClient(clientId, plainSecret, name, redirectUris, allowedScopes, grantTypes) {
  const existing = _db.get('SELECT client_id FROM clients WHERE client_id = ?', [clientId]);
  if (existing) {
    return;
  }

  const secretHash = bcrypt.hashSync(plainSecret, 10);
  _db.run(
    'INSERT INTO clients (client_id, client_secret_hash, name, redirect_uris, allowed_scopes, grant_types) VALUES (?, ?, ?, ?, ?, ?)',
    [clientId, secretHash, name, redirectUris, allowedScopes, grantTypes]
  );
}

const db = {
  findUserByEmail: function (email) {
    return _db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
  },

  findUserById: function (id) {
    return _db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [id]);
  },

  findClient: function (clientId) {
    return _db.get('SELECT * FROM clients WHERE client_id = ? AND is_active = 1', [clientId]);
  },

  insertAuthCode: function (code, clientId, userId, redirectUri, scope, expiresAt, codeChallenge) {
    _db.run(
      'INSERT INTO auth_codes (code, client_id, user_id, redirect_uri, scope, expires_at, code_challenge) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, clientId, userId, redirectUri, scope, expiresAt, codeChallenge]
    );
  },

  findAuthCode: function (code) {
    return _db.get('SELECT * FROM auth_codes WHERE code = ?', [code]);
  },

  markAuthCodeUsed: function (code) {
    _db.run("UPDATE auth_codes SET used_at = datetime('now') WHERE code = ?", [code]);
  },

  insertAccessToken: function (jti, userId, clientId, scope, expiresAt) {
    _db.run('INSERT INTO access_tokens (jti, user_id, client_id, scope, expires_at) VALUES (?, ?, ?, ?, ?)', [
      jti,
      userId,
      clientId,
      scope,
      expiresAt
    ]);
  },

  findAccessToken: function (jti) {
    return _db.get('SELECT * FROM access_tokens WHERE jti = ?', [jti]);
  },

  revokeAccessToken: function (jti) {
    _db.run("UPDATE access_tokens SET revoked_at = datetime('now') WHERE jti = ?", [jti]);
  },

  insertRefreshToken: function (id, tokenHash, familyId, userId, clientId, scope, expiresAt) {
    _db.run(
      'INSERT INTO refresh_tokens (id, token_hash, family_id, user_id, client_id, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, tokenHash, familyId, userId, clientId, scope, expiresAt]
    );
  },

  findRefreshToken: function (tokenHash) {
    return _db.get('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
  },

  markRefreshTokenUsed: function (id, replacedBy) {
    _db.run("UPDATE refresh_tokens SET used_at = datetime('now'), replaced_by = ? WHERE id = ?", [replacedBy, id]);
  },

  revokeFamilyTokens: function (familyId) {
    _db.run("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE family_id = ?", [familyId]);
  },

  revokeRefreshToken: function (tokenHash) {
    _db.run("UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?", [tokenHash]);
  },

  upsertConsent: function (userId, clientId, grantedScopes) {
    _db.run('INSERT OR REPLACE INTO consents (id, user_id, client_id, granted_scopes) VALUES (?, ?, ?, ?)', [
      uuidv4(),
      userId,
      clientId,
      grantedScopes
    ]);
  },

  findConsent: function (userId, clientId) {
    return _db.get('SELECT * FROM consents WHERE user_id = ? AND client_id = ?', [userId, clientId]);
  },

  getRecentAuditLogs: function (limit) {
    return _db.all('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?', [limit || 50]);
  },

  auditLog: function (eventType, userId, clientId, ipAddress, userAgent, success, errorMessage, metadata) {
    try {
      _db.run(
        'INSERT INTO audit_logs (event_type, user_id, client_id, ip_address, user_agent, success, error_message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          eventType,
          userId || null,
          clientId || null,
          ipAddress || null,
          userAgent || null,
          success ? 1 : 0,
          errorMessage || null,
          metadata ? JSON.stringify(metadata) : null
        ]
      );
    } catch (e) {
      console.error('[db] Audit log error:', e.message);
    }
  }
};

module.exports = { initDatabase, db };
