const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function load(name, imports = {}) {
  const source = readFileSync(path.join(__dirname, '../ott/src', name + '.ts'), 'utf8');
  const result = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}});
  const exports = {};
  vm.runInNewContext(result.outputText, {exports, require: key => imports[key], process: {env: {}}});
  return exports;
}
const catalog = load('catalog');
const {ProfileLibrary, libraryId} = load('profile-library', {'./catalog': catalog, './tmdb': load('tmdb')});
const {PlaybackHistory} = load('playback-history');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('local profile libraries persist independently and preserve the most recent saved or played film', async () => {
  const records = new Map();
  const storage = {getItem: async key => records.get(key) ?? null, setItem: async (key, value) => records.set(key, value)};
  const explorer = new ProfileLibrary(storage, 'explorer');
  const other = new ProfileLibrary(storage, 'stargazer');
  await Promise.all([explorer.load(), other.load()]);
  const [one, two] = catalog.films;
  explorer.toggle(one); explorer.toggle(two);
  other.toggle(two);
  explorer.progress(two, 12, 500, false);
  explorer.progress(one, 9, 500, false);
  explorer.progress(two, 32, 500, false);
  await tick();
  const restarted = new ProfileLibrary(storage, 'explorer');
  await restarted.load();
  assert.deepEqual(Array.from(restarted.read().saved, libraryId), [libraryId(two), libraryId(one)]);
  assert.deepEqual(Array.from(restarted.read().watching, item => [item.film.id,item.position]), [[two.id,32],[one.id,9]]);
  assert.deepEqual(Array.from(other.read().saved, libraryId), [libraryId(two)]);
  assert.deepEqual(Array.from(other.read().watching), []);
  restarted.toggle(two);
  restarted.progress(two, 500, 500, true);
  await tick();
  const saved = JSON.parse(records.get('explorer'));
  assert.deepEqual(saved.saved.map(item => item.id), [one.id]);
  assert.deepEqual(saved.watching.map(item => item.film.id), [one.id]);
});

test('writes stay ordered and coalesce; failed reads do not overwrite a stored profile', async () => {
  let release;
  let broken = true;
  const writes = [];
  const storage = {getItem: async () => broken ? 'broken JSON' : null, setItem: async (_key, value) => {
    writes.push(value);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
  }};
  const library = new ProfileLibrary(storage, 'explorer');
  await library.load();
  library.toggle(catalog.films[0]);
  assert.equal(library.read().ready, false);
  assert.equal(writes.length, 0);
  broken = false;
  library.retry(); await tick();
  for (const film of catalog.films.slice(0, 3)) library.toggle(film);
  assert.equal(writes.length, 1);
  release(); await tick();
  assert.deepEqual(writes.map(raw => JSON.parse(raw).saved.length), [1,3]);
});

test('history resumes once, requires real playback, checkpoints and flushes without recreating completed titles', () => {
  const observed = [];
  const history = new PlaybackHistory(20, (...args) => observed.push(args));
  assert.equal(history.resumeAt(120), 20);
  assert.equal(history.resumeAt(120), 0);
  history.progress(20,120);
  history.flush();
  assert.deepEqual(observed, []);
  history.playing();
  history.progress(21,120);
  history.progress(24,120);
  history.progress(31,120);
  history.progress(32,120);
  history.flush(); history.flush();
  history.ended(120);
  history.progress(119,120); history.flush();
  assert.deepEqual(observed, [[21,120,false],[31,120,false],[32,120,false],[120,120,true]]);
});

test('reopening a TMDB title keeps its validated backdrop and optional title image for Continue Watching', async () => {
  let written = null;
  const storage = {getItem: async () => written, setItem: async (_key, value) => { written = value; }};
  const film = {id:'tmdb:movie:91', kind:'movie', source:'tmdb', art:0, title:'Saved title', category:'Drama', synopsis:'Story', year:2026,
    backdropUrl:'https://image.tmdb.org/t/p/w1280/card.jpg', titleLogoUrl:'https://image.tmdb.org/t/p/w500/title.png'};
  const current = new ProfileLibrary(storage, 'one');
  await current.load(); current.toggle(film); current.progress(film, 56, 634, false); await tick();
  const reopened = new ProfileLibrary(storage, 'one');
  await reopened.load();
  assert.equal(reopened.read().saved[0].backdropUrl, film.backdropUrl);
  assert.equal(reopened.read().watching[0].film.titleLogoUrl, film.titleLogoUrl);
});
