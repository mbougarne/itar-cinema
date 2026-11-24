const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../ott/src/browser-session.ts'), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}});
const key = 'itar.probe.session.v1';
function load(values = new Map(), os = 'web', blocked = false) {
  const profileSource = fs.readFileSync(path.join(__dirname, '../ott/src/cinema-profiles.ts'), 'utf8');
  const compiled = ts.transpileModule(profileSource, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const profiles = {exports: {}, require: () => ({})};
  vm.runInNewContext(compiled, profiles);
  const context = {exports: {}, require: name => name === './cinema-profiles' ? profiles.exports : {Platform: {OS: os}}};
  Object.defineProperty(context, 'localStorage', {get() {
    if (blocked) { throw new Error('Storage denied'); }
    return {
      getItem: name => values.get(name) ?? null,
      setItem: (name, value) => values.set(name, value),
      removeItem: name => values.delete(name),
    };
  }});
  vm.runInNewContext(outputText, context);
  return context.exports;
}

test('a new page restores signed-in state, selected profile and TMDB source', () => {
  const values = new Map();
  load(values).saveBrowserSession({mode: 'proxy', profile: 'Stargazer', password: 'must-not-be-saved'});
  assert.deepEqual(JSON.parse(values.get(key)), {signedIn: true, mode: 'proxy', profile: 'Stargazer'});
  const restored = load(values).readBrowserSession();
  assert.equal(restored.mode, 'proxy');
  assert.equal(restored.profile, 'Stargazer');
});

test('sign-out removes the demo session while preserving unrelated local storage', () => {
  const values = new Map([['unrelated', 'keep']]);
  const session = load(values);
  session.saveBrowserSession({mode: 'fixture', profile: 'Explorer'});
  session.saveBrowserSession(null);
  assert.equal(values.has(key), false);
  assert.equal(load(values).readBrowserSession(), null);
  assert.equal(values.get('unrelated'), 'keep');
});

test('malformed or unsupported session records do not bypass demo sign-in', () => {
  for (const value of ['{', 'null', 'true', '{}',
    JSON.stringify({signedIn: false, mode: 'proxy', profile: 'Explorer'}),
    JSON.stringify({signedIn: true, mode: 'other', profile: 'Explorer'}),
    JSON.stringify({signedIn: true, mode: 'proxy', profile: 'unknown'})]) {
    assert.equal(load(new Map([[key, value]])).readBrowserSession(), null);
  }
});

test('blocked storage stays usable and native platforms do not access storage', () => {
  for (const os of ['web', 'android', 'ios']) {
    const session = load(new Map(), os, true);
    assert.equal(session.readBrowserSession(), null);
    assert.doesNotThrow(() => session.saveBrowserSession({mode: 'proxy', profile: 'Explorer'}));
    assert.doesNotThrow(() => session.saveBrowserSession(null));
  }
  const values = new Map();
  load(values, 'android').saveBrowserSession({mode: 'proxy', profile: 'Explorer'});
  assert.equal(values.size, 0);
});
