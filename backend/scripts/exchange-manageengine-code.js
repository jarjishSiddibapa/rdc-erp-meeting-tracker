require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '..', '.env');

function upsertEnvValue(contents, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');
  if (pattern.test(contents)) return contents.replace(pattern, () => line);
  return `${contents.replace(/\s*$/, '')}\n${line}\n`;
}

function removeEnvValue(contents, name) {
  const pattern = new RegExp(`^${name}=.*(?:\\r?\\n|$)`, 'm');
  return contents.replace(pattern, '');
}

async function main() {
  const accountsUrl = String(process.env.MANAGEENGINE_ACCOUNTS_URL || 'https://accounts.zoho.com').replace(/\/+$/, '');
  const clientId = String(process.env.MANAGEENGINE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.MANAGEENGINE_CLIENT_SECRET || '').trim();
  const code = String(process.env.MANAGEENGINE_AUTH_CODE || '').trim();
  const redirectUri = String(process.env.MANAGEENGINE_REDIRECT_URI || '').trim();

  const missing = [
    ['MANAGEENGINE_CLIENT_ID', clientId],
    ['MANAGEENGINE_CLIENT_SECRET', clientSecret],
    ['MANAGEENGINE_AUTH_CODE', code],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')} in backend/.env`);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });
  if (redirectUri) body.set('redirect_uri', redirectUri);

  const response = await fetch(`${accountsUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.refresh_token) {
    throw new Error(`Token exchange failed: ${payload.error || `HTTP ${response.status}`}. Generate a new offline authorization code and try immediately.`);
  }

  let envContents = fs.readFileSync(ENV_PATH, 'utf8');
  envContents = upsertEnvValue(envContents, 'MANAGEENGINE_REFRESH_TOKEN', payload.refresh_token);
  if (payload.api_domain) envContents = upsertEnvValue(envContents, 'MANAGEENGINE_API_DOMAIN', payload.api_domain);
  envContents = removeEnvValue(envContents, 'MANAGEENGINE_AUTH_CODE');
  fs.writeFileSync(ENV_PATH, envContents, 'utf8');

  console.log('OAuth exchange succeeded. The refresh token was saved securely in backend/.env.');
  console.log('Restart the application, then use Sync SRs from ManageEngine to test it.');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
