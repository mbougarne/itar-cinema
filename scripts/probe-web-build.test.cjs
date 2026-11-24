const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');
const {webPlugins, writeShell} = require('../web/build.cjs');

test('web image requires resolve to copied relative RN image sources', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'itar-web-asset-'));
  try {
    const file = path.join(directory, 'image.png');
    const bytes = Buffer.from([137, 80, 78, 71]);
    fs.writeFileSync(file, bytes);
    const {outputFiles} = await esbuild.build({
      stdin: {contents: `module.exports = require(${JSON.stringify(file)})`, resolveDir: directory},
      bundle: true, format: 'cjs', platform: 'browser', write: false, plugins: webPlugins(directory),
    });
    const context = {module: {exports: {}}};
    vm.runInNewContext(outputFiles[0].text, context);
    const {uri} = context.module.exports;
    assert.match(uri, /^\.\/assets\/[a-f0-9]{16}\.png$/);
    assert.deepEqual(fs.readFileSync(path.join(directory, uri)), bytes);
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});

test('TV staging manifests reference local entry and correctly sized test icons', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'itar-web-manifest-'));
  try {
    for (const target of ['browser', 'tizen', 'webos']) {
      const outdir = path.join(directory, target);
      fs.mkdirSync(outdir);
      writeShell(target, outdir);
      const html = fs.readFileSync(path.join(outdir, 'index.html'), 'utf8');
      assert.match(html, /src="\.\/app\.js"/);
      assert.doesNotMatch(html, /type="module"|https?:\/\//);
      const icon = fs.readFileSync(path.join(outdir, 'icon.png'));
      const size = target === 'tizen' ? 117 : 80;
      assert.equal(icon.readUInt32BE(16), size);
      assert.equal(icon.readUInt32BE(20), size);
      if (target === 'webos') {
        const manifest = JSON.parse(fs.readFileSync(path.join(outdir, 'appinfo.json'), 'utf8'));
        assert.equal(manifest.type, 'web');
        assert.equal(manifest.disableBackHistoryAPI, true);
        assert.ok(fs.existsSync(path.join(outdir, manifest.main)));
        assert.ok(fs.existsSync(path.join(outdir, manifest.icon)));
      } else if (target === 'tizen') {
        const manifest = fs.readFileSync(path.join(outdir, 'config.xml'), 'utf8');
        assert.match(manifest, /profile name="tv-samsung"/);
        assert.match(manifest, /content src="index.html"/);
        assert.match(manifest, /package="[A-Za-z0-9]{10}"/);
      }
    }
    assert.throws(() => writeShell('../outside', directory), /Unknown web target/);
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});

function platform(webOSSystem) {
  const source = fs.readFileSync(path.join(__dirname, '../web/platform.ts'), 'utf8');
  const {code} = esbuild.transformSync(source, {loader: 'ts', format: 'cjs'});
  const handlers = new Set();
  const captureModes = [];
  const context = {module: {exports: {}}, require: () => ({}),
    document: {addEventListener: (_, listener, capture) => { captureModes.push(capture); handlers.add(listener); },
      removeEventListener: (_, listener, capture) => { captureModes.push(capture); handlers.delete(listener); }},
    window: {webOSSystem, alert() {}, confirm: () => false, close() {}},
  };
  vm.runInNewContext(code, context);
  return {...context.module.exports, handlers, captureModes};
}

test('browser and TV Back dispatch newest listener first, consume once and clean up', () => {
  const {BackHandler, handlers, captureModes} = platform();
  let calls = '';
  const outer = BackHandler.addEventListener('hardwareBackPress', () => { calls += 'outer'; return true; });
  const inner = BackHandler.addEventListener('hardwareBackPress', () => { calls += 'inner'; return true; });
  assert.deepEqual(captureModes, [true], 'Back must precede RNW editor bubbling suppression');
  const event = (key, keyCode = 0) => ({key, keyCode, defaultPrevented: false, repeat: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}});
  const dispatch = value => [...handlers].forEach(handler => handler(value));
  const press = event('', 10009);
  dispatch(press);
  assert.equal(calls, 'inner');
  assert.equal(press.defaultPrevented, true);
  inner.remove();
  dispatch(event('', 461));
  assert.equal(calls, 'innerouter');
  dispatch(event('a'));
  dispatch({...event('Escape'), repeat: true});
  assert.equal(calls, 'innerouter');
  outer.remove();
  assert.equal(handlers.size, 0);
  assert.deepEqual(captureModes, [true, true], 'capture listener is removed in the same phase');
});

test('an Alert action does not also dispatch onDismiss', () => {
  const {Alert} = platform();
  let calls = 0;
  Alert.alert('Exit', 'Use Home', [{text: 'Cancel', onPress: () => { calls += 1; }}],
    {onDismiss: () => { calls += 1; }});
  assert.equal(calls, 1);
});

test('LG Back reaches the system only after all screen handlers decline it', () => {
  let exits = 0;
  const {BackHandler, handlers} = platform({platformBack: () => { exits++; }});
  BackHandler.addEventListener('hardwareBackPress', () => false);
  const player = BackHandler.addEventListener('hardwareBackPress', () => true);
  const send = () => handlers.forEach(handler => handler({
    keyCode: 461, preventDefault() {}, stopPropagation() {},
  }));
  send();
  assert.equal(exits, 0);
  player.remove();
  send();
  assert.equal(exits, 1);
});
