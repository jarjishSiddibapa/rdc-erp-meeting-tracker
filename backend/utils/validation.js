const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const RDC_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@rdc\.in$/i;

// Splits a comma-separated recipients string (e.g. from backup_settings.email_recipients)
// into trimmed, de-duplicated, validated addresses. Used both to validate on save and to
// build the actual send list, so the two can never drift apart.
function parseEmailList(raw) {
  const seen = new Set();
  const valid = [];
  const invalid = [];
  for (const part of String(raw || '').split(',')) {
    const email = part.trim();
    if (!email) continue;
    if (!EMAIL_REGEX.test(email)) { invalid.push(email); continue; }
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push(email);
  }
  return { valid, invalid };
}

module.exports = { EMAIL_REGEX, RDC_EMAIL_REGEX, parseEmailList };
