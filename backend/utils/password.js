const crypto = require('crypto');

// Avoids visually ambiguous characters (0/O, 1/l/I) since this is read off an email by a
// human and typed in (or copy-pasted) once before they set their own password.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';

function generateRandomPassword(length = 12) {
  const bytes = crypto.randomBytes(length);
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += CHARSET[bytes[i] % CHARSET.length];
  return pwd;
}

module.exports = { generateRandomPassword };
