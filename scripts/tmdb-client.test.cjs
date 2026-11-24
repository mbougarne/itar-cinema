const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const temporary = mkdtempSync(path.join(tmpdir(), 'itar-tmdb-client-'));
let api;
try {
  const result = ts.transpileModule(readFileSync(path.join(__dirname, '../ott/src/tmdb.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}});
  writeFileSync(path.join(temporary, 'tmdb.cjs'), result.outputText);api = require(path.join(temporary, 'tmdb.cjs'));
} finally { rmSync(temporary, {recursive: true}); }
const film = {id: 'tmdb:movie:11', title: 'Mapped title', kind: 'movie', year: 2026, synopsis: 'Actual mapped synopsis', category: 'Adventure', source: 'tmdb', posterUrl: 'https://image.tmdb.org/t/p/w500/test.jpg', backdropUrl: null};
test('public mapper rejects arbitrary artwork URLs and inconsistent media identity', () => {
  assert.equal(api.parseFilm(film).posterUrl, film.posterUrl);
  assert.throws(() => api.parseFilm({...film, posterUrl: 'http://example.invalid/image.jpg'}), /artwork/);
  assert.throws(() => api.parseFilm({...film, kind: 'series'}), /metadata/);
  assert.throws(() => api.parseFilm({...film, source: 'invented'}), /metadata/);
});
test('client talks only to the public loopback proxy and preserves mapped page identity/source', async () => {
  const original = global.fetch;
  global.fetch = async (url, options) => {
    const parsed = new URL(url);assert.equal(parsed.origin, 'http://127.0.0.1:8789');
    assert.equal(parsed.pathname, '/v1/catalogue');assert.equal(parsed.searchParams.get('kind'), 'movie');
    assert.ok(!parsed.searchParams.has('api_key'));assert.equal(options.headers, undefined);
    return new Response(JSON.stringify({source: 'tmdb', rows: [{id: 'page-1', title: 'Popular', format: 'poster', entries: [film]}], nextCursor: 'next'}));
  };
  try {
    const page = await api.fetchProxyPage('movie', '', null, {signal: new AbortController().signal});
    assert.equal(page.source, 'tmdb');assert.equal(page.rows[0].entries[0].id, film.id);assert.equal(page.nextCursor, 'next');
  } finally { global.fetch = original; }
});
test('client refuses details for a different selected title and does not substitute fixture metadata', async () => {
  const original = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({film: {...film, id: 'tmdb:movie:12'}, cast: []}));
  try { await assert.rejects(api.fetchDetails(film, new AbortController().signal), /identity/); }
  finally { global.fetch = original; }
});
test('details accepts bounded related metadata and rejects duplicates or a selected-title echo', async () => {
  const original = global.fetch;
  let related = [{...film, id: 'tmdb:movie:12', title: 'Related title'}];
  global.fetch = async () => new Response(JSON.stringify({film, cast: [], related}));
  try {
    assert.equal((await api.fetchDetails(film, new AbortController().signal)).related[0].title, 'Related title');
    related = [film];await assert.rejects(api.fetchDetails(film, new AbortController().signal), /related identities/);
    related = [{...film, id: 'tmdb:movie:12'}, {...film, id: 'tmdb:movie:12'}];
    await assert.rejects(api.fetchDetails(film, new AbortController().signal), /related identities/);
  } finally { global.fetch = original; }
});

test('metadata accepts real rating and territory but rejects nonfinite and oversized values', () => {
  const mapped = api.parseFilm({...film, rating: 8.4, votes: 150, runtime: 128, certification: 'PG-13', certificationRegion: 'US', languages: 'English'});
  assert.equal(mapped.rating, 8.4);assert.equal(mapped.certificationRegion, 'US');assert.equal(mapped.runtime, 128);
  for (const rating of [NaN, Infinity, -1, 11, '8']) { assert.throws(() => api.parseFilm({...film, rating}), /metadata/); }
  assert.throws(() => api.parseFilm({...film, tagline: 'x'.repeat(501)}), /metadata/);
});

test('details keeps earlier valid artwork for missing fields and prefers newly supplied artwork per field', async t => {
  const fromCatalogue = {
    ...film, backdropUrl: 'https://image.tmdb.org/t/p/w1280/catalogue.jpg',
    titleLogoUrl: 'https://image.tmdb.org/t/p/w500/logo.png',
  };
  const details = {...film, posterUrl: 'https://image.tmdb.org/t/p/w500/new.jpg', backdropUrl: null};
  t.mock.method(global, 'fetch', async () => new Response(JSON.stringify({film: details, cast: [], related: []})));
  const read = initial => api.fetchDetails(initial, new AbortController().signal);
  const enriched = (await read(fromCatalogue)).film;
  assert.equal(enriched.posterUrl, details.posterUrl);
  assert.equal(enriched.backdropUrl, fromCatalogue.backdropUrl);
  assert.equal(enriched.titleLogoUrl, fromCatalogue.titleLogoUrl);
  details.posterUrl = null;
  assert.equal((await read(fromCatalogue)).film.posterUrl, fromCatalogue.posterUrl);
  await assert.rejects(read({...fromCatalogue, titleLogoUrl: 'https://example.invalid/untrusted.png'}), /artwork/);
});
