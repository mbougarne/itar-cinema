const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync, mkdtempSync, writeFileSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const temporary = mkdtempSync(path.join(tmpdir(), 'itar-guide-'));
let parseGuide, guideWindow, fixtureGuide;
try {
  const compiled = ts.transpileModule(readFileSync(path.join(__dirname, '../ott/src/guide-data.ts'), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}});
  writeFileSync(path.join(temporary, 'guide.cjs'), compiled.outputText);
  ({parseGuide, guideWindow, fixtureGuide} = require(path.join(temporary, 'guide.cjs')));
} finally { rmSync(temporary, {recursive: true}); }
const programme = (start, stop, title = 'News') => ({start, stop, title});
const data = channels => ({updated: '2026-10-31T11:00:00Z', channels});
test('guide validates UTC intervals, retains one hour of history and filters far-future programmes and sorts a bounded window', () => {
  const guide = parseGuide(data([{name: 'ABC', programmes: [programme(120, 150), programme(80, 110), programme(-4000, -3900), programme(100, 99), programme(40000, 40100), programme(NaN, Infinity), programme(120, 180)]}]), 100);
  assert.deepEqual(guide.channels[0].programmes.map(p => p.start), [80, 120]);
  assert.throws(() => parseGuide(data(null)), /invalid guide/);
  assert.throws(() => parseGuide({updated: 'invalid', channels: []}), /invalid guide/);
});
test('guide deduplicates channel identities and bounds registration to six channels with forty-eight programmes each', () => {
  const channel = name => ({name, programmes: Array.from({length: 70}, (_, i) => programme(100 + i * 20, 120 + i * 20))});
  const guide = parseGuide(data([channel('A'), channel('A'), ...Array.from({length: 20}, (_, i) => channel(`Channel ${i}`))]), 100);
  assert.equal(guide.channels.length, 6);assert.equal(new Set(guide.channels.map(c => c.id)).size, 6);
  assert.ok(guide.channels.every(c => c.programmes.length === 48));
  assert.deepEqual(parseGuide(data([channel('Old')]), 100000).channels, []);
});

test('guide time navigation clamps to available listings and Now restores the current half hour', () => {
  const guide = parseGuide(data([{name: 'ABC', programmes: [programme(0, 3600), programme(3600, 7200), programme(7200, 18000)]}]), 3600);
  assert.deepEqual(guideWindow(guide, 4000, null), {start: 3600, end: 10800, previous: true, next: true});
  assert.deepEqual(guideWindow(guide, 4000, -10000), {start: 0, end: 7200, previous: false, next: true});
  assert.deepEqual(guideWindow(guide, 4000, 99999), {start: 10800, end: 18000, previous: true, next: false});
  assert.deepEqual(guideWindow(null, 4000, null), {start: 3600, end: 10800, previous: false, next: false});
});


test('offline guide provides stable programme keys across a half-hour rollover in a held window', () => {
  const now = 1795458585;
  const guide = fixtureGuide(now);
  const window = guideWindow(guide, now, null);
  const matching = time => guide.channels.map(channel => channel.programmes.find(p => p.start <= time && time < p.stop));
  const first = matching(now);
  const next = matching(window.start + 1800);
  assert.equal(guide.channels.length, 3);
  assert.ok(first.every((item, i) => next[i].start === item.stop));
  assert.equal(guideWindow(guide, window.start + 1800, window.start).start, window.start);
});
