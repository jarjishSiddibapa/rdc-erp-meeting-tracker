require('dotenv').config();

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

  console.log('OAuth exchange succeeded. Copy these values into backend/.env:');
  console.log(`MANAGEENGINE_REFRESH_TOKEN=${payload.refresh_token}`);
  if (payload.api_domain) console.log(`MANAGEENGINE_API_DOMAIN=${payload.api_domain}`);
  console.log('Then delete MANAGEENGINE_AUTH_CODE from backend/.env and restart the application.');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
