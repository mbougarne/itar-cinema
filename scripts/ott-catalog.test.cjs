const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const temporary = mkdtempSync(path.join(tmpdir(), 'itar-ott-catalog-'));
let catalog, CatalogueSession, layoutRows;
try {
  for (const name of ['catalog', 'session', 'browse-layout']) {
    const compiled = ts.transpileModule(readFileSync(path.join(__dirname, `../ott/src/${name}.ts`), 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS},
    });
    writeFileSync(path.join(temporary, `${name}.js`), compiled.outputText);
  }
  catalog = require(path.join(temporary, 'catalog.js'));
  ({layoutRows, chartRows} = require(path.join(temporary, 'browse-layout.js')));
  ({CatalogueSession} = require(path.join(temporary, 'session.js')));
} finally { rmSync(temporary, {recursive: true}); }
const options = () => ({signal: new AbortController().signal, delay: 0});
test('stable unique catalogue and cast IDs, honest metadata-only fixtures', () => {
  assert.equal(catalog.films.length, 96);
  assert.equal(new Set(catalog.films.map(film => film.id)).size, 96);
  assert.equal(new Set(catalog.cast.map(member => member.id)).size, 4);
  for (const film of catalog.films) {
    assert.ok(film.title && film.synopsis && film.art >= 0 && film.art < 8);
    assert.equal('playableRef' in film, false);
  }
});
test('pagination appends distinct rows, two landscape and two poster rows per page, then ends', async () => {
  const first = await catalog.fetchPage('all', '', null, options());
  const second = await catalog.fetchPage('all', '', first.nextCursor, options());
  assert.deepEqual(first.rows.map(row => row.format), ['landscape', 'landscape', 'poster', 'poster']);
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, 8);
  assert.equal(second.nextCursor, null);
  assert.equal(first.source, 'simulated-local');
  assert.ok(first.rows[0].entries.includes(catalog.hero));
  assert.equal(new Set([...first.rows, ...second.rows].flatMap(row => row.entries.map(film => film.id))).size, 48);
  assert.ok(first.rows.flatMap(row => row.entries).some(film => film.kind === 'series'));
});
test('Movies/Series filtering, search normalization, empty results and cursor isolation', async () => {
  for (const kind of ['movie', 'series']) {
    const page = await catalog.fetchPage(kind, '', null, options());
    assert.ok(page.rows.flatMap(row => row.entries).every(film => film.kind === kind));
  }
  const matches = await catalog.fetchPage('all', ' ATLAS ', null, options());
  assert.ok(matches.rows.flatMap(row => row.entries).every(film => film.title.includes('Atlas')));
  assert.deepEqual((await catalog.fetchPage('all', 'missing-title', null, options())).rows, []);
  const page = await catalog.fetchPage('movie', '', null, options());
  await assert.rejects(catalog.fetchPage('series', '', page.nextCursor, options()), /Cursor/);
  await assert.rejects(catalog.fetchPage('movie', '', 'movie//NaN', options()), /Cursor/);
});
test('aborting an asynchronous fetch rejects without returning a page', async () => {
  const controller = new AbortController();
  const pending = catalog.fetchPage('all', '', null, {signal: controller.signal, delay: 20});
  controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  await assert.rejects(catalog.fetchPage('all', '', null, {signal: controller.signal, delay: 0}), {name: 'AbortError'});
});
test('rapid end events coalesce, failure keeps prior rows, retry appends exactly once', async () => {
  let fail = false, calls = 0;
  const session = new CatalogueSession('movie', '', () => ({delay: 0, fail}), (...args) => { calls += 1; return catalog.fetchPage(...args); });
  await session.start();
  const original = session.snapshot().rows;
  fail = true;
  await Promise.all([session.loadMore(), session.loadMore(), session.loadMore()]);
  assert.equal(calls, 2);
  assert.equal(session.snapshot().rows, original);
  assert.match(session.snapshot().error, /Simulated/);
  fail = false;
  await session.loadMore();
  assert.equal(session.snapshot().rows.length, 8);
  await session.loadMore();
  assert.equal(calls, 3);
  session.dispose();
});
test('a disposed/restarted request cannot overwrite new state even when transport ignores abort', async () => {
  const resolvers = [];
  const session = new CatalogueSession('all', '', () => ({delay: 0, fail: false}), () => new Promise(resolve => resolvers.push(resolve)));
  const old = session.start();
  const next = session.start();
  resolvers[1]({rows: [{id: 'new', title: 'New', format: 'landscape', entries: [catalog.films[0]]}], nextCursor: null, source: 'simulated-local'});
  await next;
  resolvers[0]({rows: [{id: 'old', title: 'Old', format: 'landscape', entries: [catalog.films[1]]}], nextCursor: null, source: 'simulated-local'});
  await old;
  assert.equal(session.snapshot().rows[0].id, 'new');
  session.dispose();
});

test('a larger provider preserves prior targets and explicitly caps the viewing window at48', async () => {
  let page = 0;
  const session = new CatalogueSession('all', '', () => ({delay: 0, fail: false}), async () => {
    const entries = catalog.films.slice(page * 20, ++page * 20);
    return {rows: [{id: `page-${page}`, title: 'Page', format: 'landscape', entries}], nextCursor: String(page), source: 'tmdb-mock'};
  }, 48);
  await session.start();const original = session.snapshot().rows[0];
  await session.loadMore();await session.loadMore();
  assert.equal(session.snapshot().rows.reduce((count, row) => count + row.entries.length, 0), 48);
  assert.equal(session.snapshot().rows[0], original);
  assert.equal(session.snapshot().ended, true);assert.equal(session.snapshot().limitReached, true);
  await session.loadMore();assert.equal(page, 3);session.dispose();
});

test('browse continues beyond48 while a bounded home source stops at80 without removing prior rows', async () => {
  const provider = async (_kind, _query, cursor) => {
    const page = Number(cursor || 0);
    return {rows: [{id: `page-${page}`, title: 'Page', format: 'landscape', entries: Array.from({length: 20}, (_, i) => ({...catalog.films[0], id: `movie:${page * 20 + i}`}))}], nextCursor: String(page + 1), source: 'tmdb-mock'};
  };
  const home = new CatalogueSession('all', '', () => ({delay: 0, fail: false}), provider, 80);
  await home.start();for (let i = 0; i < 8; i++) { await home.loadMore(); }assert.equal(home.snapshot().rows.length, 4);assert.equal(home.snapshot().limitReached, true);home.dispose();
  const browse = new CatalogueSession('movie', '', () => ({delay: 0, fail: false}), provider);
  await browse.start();const first = browse.snapshot().rows[0];
  for (let i = 0; i < 20; i++) { await browse.loadMore(); }
  assert.equal(browse.snapshot().rows.flatMap(row => row.entries).length, 160);
  assert.equal(browse.snapshot().rows[0], first);assert.equal(browse.snapshot().limitReached, true);await browse.nextWindow();assert.equal(browse.snapshot().rows[0].entries[0].id, 'movie:160');browse.dispose();
});
test('repeated cursors cannot append the same logical page', async () => {
  const session = new CatalogueSession('all', '', () => ({delay: 0, fail: false}), async () => ({rows: [{id: 'same', entries: [catalog.films[0]]}], nextCursor: 'same', source: 'tmdb-mock'}));
  await session.start();const first = session.snapshot().rows;
  await session.loadMore();assert.equal(session.snapshot().rows, first);assert.match(session.snapshot().error, /did not advance/);session.dispose();
});

test('Home packs sixty distinct titles into four fifteen-title rails with stable append positions', () => {
  const page = n => ({id: `page-${n}`, entries: Array.from({length: 20}, (_, i) => ({...catalog.films[0], id: `movie:${n * 20 + i}`}))});
  const initial = layoutRows([page(0)], 'home');
  const rows = layoutRows([page(0), page(1), page(2), page(0)], 'home');
  assert.deepEqual(rows.map(row => row.entries.length), [15, 15, 15, 15]);
  assert.equal(new Set(rows.flatMap(row => row.entries.map(f => f.id))).size, 60);
  rows.forEach((row, index) => assert.deepEqual(row.entries.slice(0, 5), initial[index].entries));
  assert.deepEqual(rows.map(row => row.format), ['landscape', 'landscape', 'poster', 'poster']);
});
test('grid has five landscape titles per row and fills a partial row without dropping page-boundary items', () => {
  const first = {id: 'first', entries: catalog.films.slice(0, 8)};
  const next = {id: 'next', entries: catalog.films.slice(7, 16)};
  const rows = layoutRows([first, next], 'grid');
  assert.deepEqual(rows.map(row => row.entries.length), [5, 5, 5, 1]);
  assert.deepEqual(rows.flatMap(row => row.entries), catalog.films.slice(0, 16));
  assert.ok(rows.every(row => row.format === 'landscape'));
  assert.deepEqual(rows[0], layoutRows([first], 'grid')[0]);
});
test('fixture categories filter both media kinds without treating a genre as a title search', async () => {
  for (const kind of ['movie', 'series']) {
    const page = await catalog.fetchPage(kind, '', null, {...options(), category: 'Drama'});
    assert.ok(page.rows.length);
    assert.ok(page.rows.flatMap(row => row.entries).every(f => f.kind === kind && f.category === 'Drama'));
  }
});


test('Home ranks distinct titles in source order in separate ten-title charts', () => {
  const movies = catalog.films.slice(0, 12);
  const series = catalog.films.slice(48, 60);
  const [movieChart, seriesChart] = chartRows([{entries: movies.flatMap((film, i) => [film, series[i]])}, {entries: [...movies, ...series]}]);
  assert.equal(movieChart.id, 'top-movies');
  assert.equal(seriesChart.id, 'top-series');
  assert.deepEqual(movieChart.entries, movies.slice(0, 10));
  assert.deepEqual(seriesChart.entries, series.slice(0, 10));
});
