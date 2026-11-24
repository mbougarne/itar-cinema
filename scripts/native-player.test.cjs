const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function compile(name) {
  const source = readFileSync(path.join(__dirname, '../ott/src', name), 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  }).outputText;
}
const hook = compile('usePlaybackControls.ts');
const time = compile('playback-time.ts');
const player = compile('Playback.tsx');

// Exercise the native player's real media, remote and idle handlers with a virtual clock.
function fixture(t, playback = {}, platform = 'android') {
  t.mock.timers.enable({apis: ['setTimeout']});
  const slots = [], effects = [], requests = [];
  let index = 0, tree, remote, back, foreground, reader = false, closed = 0;
  const changed = (old, deps) => !old || deps.some((value, i) => value !== old.deps[i]);
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children}}),
    useRef: value => (slots[index++] ??= {current: value}),
    useState: initial => {
      const slot = slots[index++] ??= {value: initial};
      return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useCallback: (fn, deps) => {
      const i = index++;
      if (changed(slots[i], deps)) slots[i] = {deps, fn};
      return slots[i].fn;
    },
    useMemo: (fn, deps) => {
      const i = index++;
      if (changed(slots[i], deps)) slots[i] = {deps, value: fn()};
      return slots[i].value;
    },
    useEffect: (fn, deps) => {
      const i = index++;
      if (changed(slots[i], deps)) effects.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = {deps, cleanup: fn()};
      });
    },
  };
  function load(output, imports) {
    const module = {exports: {}};
    vm.runInNewContext(output, {module, exports: module.exports, setTimeout, clearTimeout, require: name => {
      if (name in imports) return imports[name];
      throw new Error('Unexpected import ' + name);
    }});
    return module.exports;
  }
  const commands = {focusByKey(key) { requests.push(key); return {cancel() {}}; }};
  const subscribe = set => ({addEventListener(_, fn) { set(fn); return {remove() { set(undefined); }}; }});
  const Playback = load(player, {
    react, 'react-native-video': {__esModule: true, default: 'Video', SelectedTrackType: {SYSTEM: 'system', DISABLED: 'disabled', LANGUAGE: 'language'}},
    'react-native': {ActivityIndicator: 'Loader', View: 'View', Text: 'Text', TVFocusGuideView: 'Guide', Platform: {OS: platform, isTV: true}, useTVEventHandler: fn => { remote = fn; },
      AppState: {...subscribe(fn => { foreground = fn; }), currentState: 'active'},
      BackHandler: subscribe(fn => { back = fn; })},
    '@bougarnem/itar/react': {Focusable: 'Focusable', FocusScope: 'FocusScope', useFocusCommands: () => commands,
      occurrenceKey: (...parts) => parts.join('/'), useFocusReady: () => true, useFocusState: () => ({}), useScreenReaderEnabled: () => reader},
    './playback-history': load(compile('playback-history.ts'), {}), './demo-stream': {bigBuckBunny: {name: 'Big Buck Bunny', native: {uri: 'fixture.m3u8', type: 'm3u8'}, credit: 'Fixture credit'}},
    './language': {useCinemaLanguage: () => ({t: (value, fields = {}) => value.replace(/\{(\w+)\}/g, (token, name) => fields[name] ?? token)})},
    './usePlaybackControls': load(hook, {react}), './playback-time': load(time, {}),
    './tv-accessibility': {captionAccessible: platform === 'ios' ? false : undefined},
    './components/Action': {Action: 'Action'}, './components/Picture': {Picture: 'Picture'},
    './components/IconAction': {IconAction: 'IconAction'}, './artwork': {icons: {}}, './theme': {useDesign: () => ({s: {}, colors: {actionRing: '#FFFFFF', focusFill: '#176B7B'}})},
  }).default;
  const onClose = () => closed++;
  function render() {
    index = 0;
    tree = Playback({title: 'Fixture', onClose, ...playback});
    effects.splice(0).forEach(run => run());
  }
  const nodes = node => !node?.props ? [] : [node, ...node.props.children.flatMap(nodes)];
  const action = key => nodes(tree).find(node => (node.props.id ?? node.props.occurrenceKey) === 'player/' + key)?.props;
  const video = () => nodes(tree).find(node => node.type === 'Video').props;
  render();
  return {
    action, video, requests, loader: () => nodes(tree).find(node => node.type === 'Loader'), bands: () => nodes(tree).filter(node => node.type === 'Guide'), closed: () => closed, back: () => back(),
    media(event, data) { video()[event](data); render(); },
    start() { video().onLoad({duration: 63}); video().onPlaybackStateChanged({isPlaying: true}); render(); },
    tick(ms) { t.mock.timers.tick(ms); render(); },
    press(eventType, eventKeyAction) { remote({eventType, eventKeyAction}); render(); },
    reader(value) { reader = value; render(); },
    foreground(value) { foreground(value); render(); },
    activate(key) { action(key).onPress(); render(); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('native chrome waits for playback, then hides three seconds after the last remote activity', t => {
  const p = fixture(t);
  p.tick(5000);
  assert.ok(p.action('pause'));
  p.media('onLoad', {duration: 63});
  p.tick(5000);
  assert.ok(p.action('pause'), 'metadata alone does not start the idle timer');
  p.start();
  p.tick(2999);
  p.press('right', 1);
  p.tick(2999);
  assert.ok(p.action('pause'));
  p.tick(1);
  for (const id of ['restart', 'mute', 'close', 'rewind', 'pause', 'forward', 'timeline']) assert.equal(p.action(id), undefined);
  assert.equal(p.action('wake').focusStyle.accentColor, 'transparent');
  assert.equal(p.action('wake').focusStyle.backgroundColor, 'transparent');
  assert.equal(p.action('wake').baseAccentColor, 'transparent');
  assert.equal(p.requests.at(-1), 'player/wake');
  p.press('focus', -1);
  p.press('longRight', 0);
  p.press('longRight', 0);
  p.tick(4500);
  assert.ok(p.action('wake'));
  p.press('longRight', 1);
  assert.ok(p.action('pause'));
  assert.equal(p.requests.at(-1), 'player/pause');
  p.press('left', 0);
  p.tick(4500);
  assert.ok(p.action('pause'), 'held keys keep controls available');
  p.press('left', 1);
  p.tick(3000);
  p.activate('wake');
  assert.equal(p.video().paused, false, 'waking via the semantic action does not also pause');
  p.tick(3000);
  p.press('up', undefined);
  assert.ok(p.action('pause'), 'an unphased directional event also reveals the controls');
  p.tick(3000);
  assert.equal(p.back(), true);
  assert.equal(p.closed(), 1);
  p.unmount();
});

test('native chrome is available for paused, buffering, background, error, ended and reader states', t => {
  const p = fixture(t);
  p.start();
  const timeline = p.action('timeline');
  assert.match(timeline.accessibilityLabel, /0:00 of 1:03/);
  assert.equal(typeof timeline.onAdjust, 'function');
  assert.equal(timeline.children[0].type, 'View', 'the track provides the native target content');
  for (const hold of [null, true]) {
    p.tick(3000);
    assert.ok(p.action('wake'));
    p.reader(hold);
    p.tick(5000);
    assert.ok(p.action('timeline'));
    p.reader(false);
  }
  p.media('onBuffer', {isBuffering: true});
  p.tick(5000);
  assert.ok(p.action('timeline'));
  p.media('onBuffer', {isBuffering: false});
  p.foreground('background');
  p.tick(5000);
  assert.ok(p.action('pause'));
  p.foreground('active');
  p.activate('pause');
  p.tick(5000);
  assert.equal(p.video().paused, true);
  assert.ok(p.action('pause'));
  p.activate('pause');
  p.tick(3000);
  p.media('onEnd');
  p.tick(5000);
  assert.equal(p.action('pause').label, 'Play');
  p.media('onError');
  p.tick(5000);
  assert.equal(p.action('restart').label, 'Retry stream');
  p.unmount();
});

test('native playback resumes on load and reports progress only after the native player starts', t => {
  const checkpoints = [], seeks = [];
  const p = fixture(t, {startPosition: 12, onCheckpoint: (...values) => checkpoints.push(values)});
  p.video().ref.current = {seek: position => seeks.push(position)};
  p.media('onLoad', {duration: 100});
  assert.deepEqual(seeks, [12]);
  p.media('onProgress', {currentTime: 0});
  p.media('onProgress', {currentTime: 12});
  assert.deepEqual(checkpoints, []);
  p.media('onPlaybackStateChanged', {isPlaying: true});
  p.media('onProgress', {currentTime: 14});
  p.media('onProgress', {currentTime: 16});
  p.media('onEnd');
  p.unmount();
  assert.deepEqual(checkpoints, [[14,100,false],[100,100,true]]);
});

test('tvOS guides the D-pad between visible player rows and leaves VoiceOver to its own navigation', t => {
  const p = fixture(t, {}, 'ios');
  p.start();
  let bands = p.bands();
  assert.equal(bands.length, 2);
  assert.ok(bands.every(band => band.props.autoFocus && band.props.accessible === false));
  assert.equal(bands[0].props.children[1].props.id, 'header-actions');
  assert.equal(bands[1].props.children[0].props.id, 'transport');
  p.tick(3000);
  assert.equal(p.bands().length, 0);
  p.press('swipeUp');
  assert.equal(p.requests.at(-1), 'player/pause');
  p.tick(3000);
  p.press('up', 1);
  assert.equal(p.requests.at(-1), 'player/pause');
  assert.equal(p.bands().length, 2);
  p.reader(true);
  p.tick(5000);
  assert.equal(p.bands().length, 2);
  assert.ok(p.bands().every(band => band.props.autoFocus && band.props.accessible === false));
  p.activate('close');
  assert.equal(p.closed(), 1);
  p.unmount();
});

test('native player loader follows the first video frame, buffering and media errors', t => {
  const p = fixture(t);
  t.after(p.unmount);
  assert.ok(p.loader());
  p.media('onLoad', {duration: 63});
  assert.ok(p.loader(), 'metadata is not a displayable frame');
  p.media('onReadyForDisplay');
  assert.equal(p.loader(), undefined);
  p.media('onBuffer', {isBuffering: true});
  assert.ok(p.loader());
  p.media('onError');
  assert.equal(p.loader(), undefined);
});
