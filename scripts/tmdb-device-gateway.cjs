const http = require('node:http');
const {privateIPv4} = require('./tmdb-endpoint.cjs');

// No credentials here: forward a single device to the separately approved loopback backend.
function createGateway({client, upstreamPort = 8789, onResponse = () => {}}) {
  return http.createServer({requestTimeout: 10000, headersTimeout: 5000}, (req, res) => {
    const reject = status => { res.writeHead(status); res.end(); };
    const host = `${req.socket.localAddress}:${req.socket.localPort}`;
    if (req.socket.remoteAddress !== client || req.headers.host !== host || req.headers.origin !== undefined) {
      reject(403); return;
    }
    if (req.method !== 'GET') { reject(405); return; }
    if (!req.url.startsWith('/') || req.url.startsWith('//')) { reject(400); return; }
    let pathname;
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.origin !== 'http://127.0.0.1') { reject(400); return; }
      pathname = url.pathname;
    } catch { reject(400); return; }
    if (!['/health', '/v1/catalogue', '/v1/details', '/v1/season', '/v1/reviews', '/v1/person'].includes(pathname)) { reject(404); return; }
    const upstream = http.get({hostname: '127.0.0.1', port: upstreamPort, path: req.url,
      headers: {Host: `127.0.0.1:${upstreamPort}`, Accept: 'application/json'}}, response => {
      const status = response.statusCode || 502;
      res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'});
      response.pipe(res);
      response.on('error', () => res.destroy());
      res.once('finish', () => onResponse(status, pathname));
    });
    upstream.setTimeout(10000, () => upstream.destroy());
    upstream.on('error', () => {
      if (res.destroyed) { return; }
      if (!res.headersSent) { res.writeHead(502); }
      res.end();
    });
    res.on('close', () => upstream.destroy());
  });
}

if (require.main === module) {
  const [bind, client] = process.argv.slice(2);
  if (process.argv.length !== 4 || !privateIPv4(bind) || !privateIPv4(client)) {
    console.error('Usage: node scripts/tmdb-device-gateway.cjs <Mac-private-IPv4> <TV-private-IPv4>');
    process.exitCode = 1;
  } else {
    const server = createGateway({client, onResponse: (status, route) => console.info(`TV proxy: ${status} ${route}`)});
    server.on('error', () => { console.error('Device gateway could not bind.'); process.exitCode = 1; });
    server.listen(8788, bind, () => console.info(`Device gateway: ${bind}:8788; allowed peer ${client}`));
  }
}
module.exports = {createGateway};
