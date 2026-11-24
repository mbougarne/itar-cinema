const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const babel = require('@babel/core');
const {createGateway} = require('./tmdb-device-gateway.cjs');
const {defaultProxyURL, proxyURL, privateIPv4, inlineProxyURL} = require('./tmdb-endpoint.cjs');
const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

test('public bundle URL is loopback by default and accepts only canonical private device origins', () => {
  assert.equal(proxyURL(), defaultProxyURL);
  for (const host of ['10.0.0.2', '172.16.0.2', '172.31.255.2', '192.168.1.10']) {
    assert.equal(proxyURL(`http://${host}:8788`), `http://${host}:8788`);
  }
  for (const value of ['', 'http://example.com:8788', 'http://8.8.8.8:8788', 'http://172.32.0.2:8788',
    'https://192.168.1.10:8788', 'http://192.168.1.10:8789', 'http://192.168.1.10:8788/path',
    'http://user:password@192.168.1.10:8788', 'http://192.168.1.10:8788?api_key=fake',
    'http://192.168.1.10:8788#fragment', 'http://0xc0a8010a:8788']) {
    assert.throws(() => proxyURL(value), /TMDB/);
  }
  for (const value of [undefined, '0.0.0.0', '127.0.0.1', '::1', '192.168.1.999']) { assert.equal(privateIPv4(value), false); }
  const source = 'const endpoint = process.env.ITAR_TMDB_PROXY_URL; const unrelated = process.env.SECRET;';
  const transform = url => babel.transformSync(source, {configFile: false, babelrc: false,
    plugins: [[inlineProxyURL, {url}]]}).code;
  assert.match(transform(), /http:\/\/127\.0\.0\.1:8789/);
  assert.match(transform('http://192.168.1.10:8788'), /http:\/\/192\.168\.1\.10:8788/);
  assert.match(transform(), /process\.env\.SECRET/);
  assert.doesNotMatch(transform(), /process\.env\.ITAR_TMDB_PROXY_URL/);
});

test('gateway forwards only approved peer/host/GET routes to loopback, without caller credentials', async () => {
  let calls = 0;
  const backend = http.createServer((req, res) => {
    calls++;
    assert.equal(req.url, '/v1/catalogue?kind=movie');
    assert.equal(req.headers.host, `127.0.0.1:${backend.address().port}`);
    for (const name of ['authorization', 'cookie', 'origin', 'x-forwarded-for']) { assert.equal(req.headers[name], undefined); }
    res.end('{"source":"test"}');
  });
  const upstreamPort = await listen(backend);
  const gateway = createGateway({client: '127.0.0.1', upstreamPort});
  const denied = createGateway({client: '127.0.0.2', upstreamPort});
  try {
    const base = `http://127.0.0.1:${await listen(gateway)}`;
    const foreign = `http://127.0.0.1:${await listen(denied)}`;
    const response = await fetch(`${base}/v1/catalogue?kind=movie`, {headers: {Authorization: 'fake', Cookie: 'fake', 'X-Forwarded-For': 'fake'}});
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), {source: 'test'});
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await fetch(`${base}/health`, {headers: {Origin: 'http://127.0.0.1:8081'}})).status, 403);
    // fetch normalizes Host; use an actual HTTP request for the foreign-Host case.
    const foreignHost = await new Promise((resolve, reject) => {
      http.get(`${base}/health`, {headers: {Host: 'example.com'}}, res => {
        res.resume(); resolve(res.statusCode);
      }).on('error', reject);
    });
    assert.equal(foreignHost, 403);
    assert.equal((await fetch(`${foreign}/health`, {headers: {'X-Forwarded-For': '127.0.0.2'}})).status, 403);
    assert.equal((await fetch(`${base}/health`, {method: 'POST'})).status, 405);
    assert.equal((await fetch(`${base}/v1/fetch?url=https://example.com`)).status, 404);
    assert.equal(calls, 1);
    await close(backend);
    assert.equal((await fetch(`${base}/health`)).status, 502);
  } finally {
    await close(gateway); await close(denied);
    if (backend.listening) { await close(backend); }
  }
});
