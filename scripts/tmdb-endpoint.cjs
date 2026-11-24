const {isIP} = require('node:net');
const defaultProxyURL = 'http://127.0.0.1:8789';

function privateIPv4(value) {
  if (typeof value !== 'string' || isIP(value) !== 4) { return false; }
  const [a, b] = value.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function proxyURL(value = defaultProxyURL) {
  if (value === defaultProxyURL) { return value; }
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid public TMDB proxy URL'); }
  if (value !== url.origin || url.protocol !== 'http:' || url.port !== '8788' ||
      !privateIPv4(url.hostname) || url.username || url.password) {
    throw new Error('TMDB device URL must be a private IPv4 HTTP origin on port 8788');
  }
  return url.origin;
}

// Inline only this public setting; never read dotenv or inline other environment values.
function inlineProxyURL({types}, {url}) {
  const value = proxyURL(url);
  return {visitor: {MemberExpression(path) {
    if (path.matchesPattern('process.env.ITAR_TMDB_PROXY_URL')) {
      path.replaceWith(types.stringLiteral(value));
    }
  }}};
}

module.exports = {defaultProxyURL, privateIPv4, proxyURL, inlineProxyURL};
