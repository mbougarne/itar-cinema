const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('real environment paths are ignored while examples stay eligible for tracking', () => {
  for (const [file, ignored] of [['.env', true], ['.env.local', true], ['.env.production', true],
    ['.env.example', false], ['.env.example', false]]) {
    const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', file], {cwd: root});
    assert.equal(result.status, ignored ? 0 : 1, file);
  }
});
test('Metro excludes environment imports and preserves its prior resolver exclusions', () => {
  const prior = /existing-excluded-path/;
  const context = {module: {exports: {}}, __dirname: root, require: name => {
    if (name === 'node:path') { return path; }
    if (name === 'node:fs') { return {realpathSync: () => '/resolved/dependencies'}; }
    assert.equal(name, '@react-native/metro-config');
    return {getDefaultConfig: () => ({resolver: {blockList: prior}}), mergeConfig: (base, extra) => ({...base, ...extra})};
  }};
  vm.runInNewContext(readFileSync(path.join(root, 'metro.config.js'), 'utf8'), context);
  const exclusions = context.module.exports.resolver.blockList;
  const blocked = file => exclusions.some(rule => rule.test(file));
  for (const file of ['/app/.env', '/app/.env.local', '/app/.env.example', 'C:\\app\\.env.production', '/existing-excluded-path']) {
    assert.ok(blocked(file), file);
  }
  assert.equal(blocked('/app/src/catalog.ts'), false);
});
