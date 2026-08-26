const crypto = require('crypto');
const { pool } = require('../db/pool');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generates a reset token for the given user, stores its hash + expiry, and returns the
// raw token — the DB only ever holds the hash, same as a password, so a DB leak alone
// can't be used to reset anyone's password.
async function createResetToken(userId) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await pool.execute(
    'UPDATE users SET reset_token_hash = ?, reset_token_expires = ? WHERE id = ?',
    [tokenHash, expires, userId]
  );
  return rawToken;
}

module.exports = { hashToken, createResetToken, RESET_TOKEN_TTL_MS };
