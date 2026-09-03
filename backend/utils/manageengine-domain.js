const SERVICE_DESK_API_DOMAINS = new Map([
  ['https://accounts.zoho.com', 'https://sdpondemand.manageengine.com'],
  ['https://accounts.zoho.eu', 'https://sdpondemand.manageengine.eu'],
  ['https://accounts.zoho.in', 'https://sdpondemand.manageengine.in'],
  ['https://accounts.zoho.com.cn', 'https://servicedeskplus.cn'],
  ['https://accounts.zoho.com.au', 'https://servicedeskplus.net.au'],
  ['https://accounts.zoho.jp', 'https://servicedeskplus.jp'],
  ['https://accounts.zohocloud.ca', 'https://servicedeskplus.ca'],
  ['https://accounts.zoho.uk', 'https://servicedeskplus.uk'],
  ['https://accounts.zoho.sa', 'https://servicedeskplus.sa'],
]);

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function serviceDeskApiDomainFor(accountsUrl) {
  return SERVICE_DESK_API_DOMAINS.get(trimTrailingSlash(accountsUrl)) || '';
}

module.exports = { serviceDeskApiDomainFor, trimTrailingSlash };
