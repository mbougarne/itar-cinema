const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  }).outputText;
}
const outputText = compile('ott/src/Player.web.tsx');
const visibilityHook = compile('ott/src/usePlaybackControls.ts');
const playbackTime = {};
vm.runInNewContext(compile('ott/src/playback-time.ts'), {exports: playbackTime});

// Run the component's real handlers with controlled media events, without network.
function fixture(playback = {}, rtl = false) {
  const state = [], refs = [], effects = [], callbacks = [], pending = [], listeners = new Map();
  let cursor, refIndex, effectIndex, callbackIndex, first = true, mounted = false, tree, closed = 0, back;
  const ownership = {enabled: true};
  const document = {hidden: false, activeElement: null, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name)};
  const media = {paused: true, ended: false, currentTime: 0, duration: 60, muted: false, volume: 1, loads: 0,
    play: async () => { media.paused = false; }, pause: () => { media.paused = true; },
    addEventListener() {}, removeEventListener() {},
    load: () => { media.loads++; }, removeAttribute: name => { media.removed = name; }};
  const changed = (previous, deps) => !previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]));
  const effect = (callback, deps) => {
    const i = effectIndex++;
    if (changed(effects[i], deps)) {
      pending.push(() => { effects[i]?.cleanup?.(); effects[i] = {deps, cleanup: callback()}; });
    }
  };
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children: children.flat()}}),
    useCallback: (callback, deps) => {
      const i = callbackIndex++;
      if (changed(callbacks[i], deps)) callbacks[i] = {callback, deps};
      return callbacks[i].callback;
    },
    useContext: () => ownership,
    useRef: value => { const i = refIndex++; refs[i] ||= {current: value}; return refs[i]; },
    useState: value => { const i = cursor++; if (first) { state[i] = value; } return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useEffect: effect, useLayoutEffect: effect,
  };
  const history = {};
  vm.runInNewContext(compile('ott/src/playback-history.ts'), {exports: history});
  const hook = {};
  vm.runInNewContext(visibilityHook, {exports: hook, require: () => react, setTimeout, clearTimeout});
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, Error, document, getComputedStyle: node => ({direction: node.dir}), require: name => {
    if (name.endsWith('/language')) return {useCinemaLanguage: () => ({language: rtl ? 'ar-SA' : 'en-US', rtl, t: (value, fields = {}) => value.replace(/\{(\w+)\}/g, (token, name) => fields[name] ?? token), toggle() {}})};
    if (name === './theme') return {useDesign: () => ({colors: {muted: '#BDC8D3', focus: '#26D9F2', accent: '#98BFFF', panel: '#142131', outline: '#52616E', selection: '#285568', track: '#334B60', raised: '#1D2C3C', focusFill: '#176B7B', actionRing: '#FFFFFF', playerFocus: '#29465F', playerHover: '#B9D5FF'}})};
    if (name === 'react') { return react; }
    if (name === 'react-dom') { return {createPortal: child => child}; }
    if (name === 'hls.js') return {isSupported: () => false};
    if (name === '../../web/PlaybackIcon') { return 'PlaybackIcon'; }
    if (name === './components/Picture') return {Picture: 'Picture'};
    if (name === './playback-history') return history;
    if (name === './demo-stream') return {bigBuckBunny: {name: 'Big Buck Bunny', web: 'fixture.mp4', credit: 'Fixture credit'}};
    if (name === './playback-time') { return playbackTime; }
    if (name === './browser-navigation') { return {BrowserNavigation: {}}; }
    if (name === './usePlaybackControls') { return hook; }
    if (name === '../../web/platform') { return {BackHandler: {addEventListener: (_, fn) => { back = fn; return {remove: () => { back = null; }}; }}}; }
    throw new Error(name);
  }});
  const nodes = node => !node?.props ? [] : [node, ...node.props.children.flatMap(nodes)];
  const onClose = () => closed++;
  const focus = function () { document.activeElement = this; tree.props.onFocusCapture({target: this}); };
  const dialog = {focus, closest: () => null, querySelectorAll: () => [playControl]};
  const playControl = {focus, closest() { return this; }};
  const render = () => {
    cursor = refIndex = effectIndex = callbackIndex = 0;
    tree = module.exports.default({title: 'Test title', onClose, ...playback}); first = false;
    if (mounted) pending.splice(0).forEach(run => run());
    return tree;
  };
  render(); refs[0].current = media; refs[1].current = playControl; tree.props.ref.current = dialog;
  return {media, document, ownership, dialog, playControl, render, all: () => nodes(tree), find: label => nodes(tree).find(n => n.props['aria-label'] === label || n.props.children.includes(label)),
    mount: () => { mounted = true; pending.splice(0).forEach(run => run()); }, cleanup: () => effects.forEach(entry => entry?.cleanup?.()), back: () => back?.(), closed: () => closed,
    hide: () => { document.hidden = true; listeners.get('visibilitychange')(); }, listeners};
}

test('player starts media, exposes no fullscreen control, pauses when hidden and releases on close', async () => {
  const f = fixture(); f.mount(); await Promise.resolve();
  assert.equal(f.media.paused, false);
  const video = f.all().find(n => n.type === 'video');
  assert.equal(video.props.controls, false); assert.equal(video.props.disablePictureInPicture, true);
  assert.equal(f.all().some(n => /fullscreen/i.test(n.props['aria-label'] || '')), false);
  f.hide(); assert.equal(f.media.paused, true);
  f.find('Close player').props.onClick(); assert.equal(f.closed(), 1);
  f.cleanup(); assert.equal(f.media.removed, 'src'); assert.equal(f.listeners.size, 0); assert.equal(f.back(), undefined);
});

test('timeline and skip controls clamp seeks; replay resets an ended video; Back closes', async () => {
  const f = fixture(); f.mount();
  f.media.currentTime = 58; f.find('Forward 10 seconds').props.onClick(); assert.equal(f.media.currentTime, 60);
  f.media.currentTime = 2; f.find('Rewind 10 seconds').props.onClick(); assert.equal(f.media.currentTime, 0);
  f.find('Playback position').props.onChange({currentTarget: {value: '35'}}); assert.equal(f.media.currentTime, 35);
  f.media.ended = true; f.media.paused = true; f.find('Play').props.onClick(); await Promise.resolve(); assert.equal(f.media.currentTime, 0);
  assert.equal(f.back(), true); assert.equal(f.closed(), 1); assert.equal(f.media.paused, true);
});

test('autoplay denial offers Play; media failure offers a retry instead of an unhandled rejection', async () => {
  const f = fixture();
  f.media.play = async () => { throw Object.assign(new Error('denied'), {name: 'NotAllowedError'}); };
  f.mount(); await new Promise(resolve => setImmediate(resolve)); f.render();
  assert.ok(f.find('Press Play to start.')); assert.ok(f.find('Play'));
  f.all().find(n => n.type === 'video').props.onError(); f.render(); assert.ok(f.find('Retry'));
  f.media.play = async () => { f.media.paused = false; };
  f.find('Retry').props.onClick(); await Promise.resolve(); assert.equal(f.media.loads, 1); assert.equal(f.media.paused, false);
});

test('player keeps Tab inside its controls and leaves native slider adjustment and reader arrows alone', () => {
  const f = fixture(); const controls = ['BUTTON', 'INPUT', 'BUTTON'].map(tagName => ({tagName, focus() { this.focused = true; }}));
  let prevented = false;
  const event = {key: 'Tab', target: controls[2], currentTarget: {querySelectorAll: () => controls}, preventDefault() { prevented = true; }, stopPropagation() {}};
  f.render().props.onKeyDown(event); assert.equal(controls[0].focused, true); assert.equal(prevented, true);
  prevented = false; event.key = 'ArrowRight'; event.target = controls[1]; f.render().props.onKeyDown(event); assert.equal(prevented, false);
  f.ownership.enabled = false; event.target = controls[0]; f.render().props.onKeyDown(event); assert.equal(prevented, false);
});

test('the timeline direction follows the interface while keeping elapsed time as its value', () => {
  for (const rtl of [false, true]) {
    const f = fixture({}, rtl);
    f.all().find(n => n.type === 'video').props.onLoadedMetadata({currentTarget: {duration: 60}});
    f.render();
    const timeline = f.find('Playback position');
    assert.equal(timeline.props.dir, rtl ? 'rtl' : 'ltr');
    timeline.props.onChange({currentTarget: {value: '20'}});
    assert.equal(f.media.currentTime, 20);
  }
});

test('player arrows follow the utility, transport and timeline rows in both layout directions', () => {
  const f = fixture();
  f.all().find(n => n.type === 'video').props.onLoadedMetadata({currentTarget: {duration: 60}});
  const player = f.render();
  let focused;
  function controlsIn(node) {
    if (!node?.props) return [];
    return ['button', 'input'].includes(node.type) ? [node] : node.props.children.flatMap(controlsIn);
  }
  const rows = f.all().filter(n => n.props['data-player-row']).map(node => {
    const row = {
      dir: 'ltr',
      contains: target => row.children.includes(target),
      querySelector: () => row.children.find(control => control.entry && !control.disabled),
    };
    row.children = controlsIn(node).map(control => {
      const target = {
        label: control.props['aria-label'], tagName: control.type.toUpperCase(), entry: control.props['data-player-entry'],
        disabled: control.props.disabled, closest: () => row, focus() { focused = target; },
      };
      return target;
    });
    return row;
  });
  const modal = {querySelectorAll: selector => selector === '[data-player-row]' ? rows : rows.flatMap(row => row.children.filter(c => !c.disabled))};
  function arrow(key) {
    player.props.onKeyDown({key, target: focused, currentTarget: modal, preventDefault() {}, stopPropagation() {}});
    return focused.label;
  }
  focused = rows[1].querySelector();
  assert.equal(focused.label, 'Play');
  assert.equal(arrow('ArrowLeft'), 'Rewind 10 seconds');
  assert.equal(arrow('ArrowRight'), 'Play');
  assert.equal(arrow('ArrowRight'), 'Forward 10 seconds');
  assert.equal(arrow('ArrowDown'), 'Playback position');
  assert.equal(arrow('ArrowUp'), 'Play');
  assert.equal(arrow('ArrowUp'), 'Mute');
  assert.equal(arrow('ArrowLeft'), 'Close player');
  assert.equal(arrow('ArrowDown'), 'Play');
  rows[1].dir = 'rtl';
  assert.equal(arrow('ArrowLeft'), 'Forward 10 seconds');
  rows[2].children[0].disabled = true;
  assert.equal(arrow('ArrowDown'), 'Forward 10 seconds');
});

test('only continuous playing in TV navigation mode hides the overlay after three idle seconds', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(); f.mount(); t.after(f.cleanup);
  const video = f.all().find(n => n.type === 'video').props;
  const hidden = () => f.render().props['data-controls-hidden'] === true;
  const advance = ms => { t.mock.timers.tick(ms); return hidden(); };
  video.onPlay(); video.onCanPlay({currentTarget: f.media}); f.render();
  assert.equal(advance(6000), false, 'starting is not playing');
  video.onPlaying(); f.render();
  assert.equal(advance(2999), false);
  f.render().props.onPointerMove();
  assert.equal(advance(2999), false);
  assert.equal(advance(1), true);
  assert.equal(f.document.activeElement, f.dialog);
  f.render().props.onPointerDown();
  assert.equal(hidden(), false);
  assert.equal(f.document.activeElement, f.playControl);
  assert.equal(advance(3000), true);
  video.onWaiting(); assert.equal(hidden(), false);
  video.onCanPlay({currentTarget: f.media}); assert.equal(advance(6000), false, 'buffer is available but playback has not resumed');
  video.onPlaying(); f.render(); assert.equal(advance(3000), true);
  f.ownership.enabled = false; assert.equal(hidden(), false);
  assert.equal(advance(6000), false, 'host navigation keeps controls exposed');
  f.ownership.enabled = true; f.render();
  video.onPause(); assert.equal(advance(6000), false);
  video.onPlay(); video.onPlaying(); f.render(); assert.equal(advance(3000), true);
  video.onEnded(); assert.equal(advance(6000), false);
  video.onPlay(); video.onPlaying(); f.render(); assert.equal(advance(3000), true);
  video.onError(); assert.equal(advance(6000), false);
});

test('a hidden remote press consumes its repeats and release, restores focus and leaves Back available', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(); f.mount(); t.after(f.cleanup);
  const video = f.all().find(n => n.type === 'video').props;
  const dispatch = (phase, key, repeat = false, keyCode = 0) => {
    const event = {key, keyCode, repeat, target: f.document.activeElement, currentTarget: f.dialog,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }};
    f.render().props[phase](event);
    return !!event.prevented && !!event.stopped;
  };
  video.onPlay(); video.onPlaying(); f.render();
  const lastControl = {disabled: false, closest() { return this; }, focus: f.playControl.focus};
  lastControl.focus();
  for (const [key, code] of [['Enter', 13], [' ', 32], ['ArrowDown', 40], ['Unidentified', 39], ['Tab', 9]]) {
    t.mock.timers.tick(3000);
    assert.equal(f.render().props['data-controls-hidden'], true);
    assert.equal(f.document.activeElement, f.dialog);
    assert.equal(dispatch('onKeyDown', key, false, code), true);
    assert.equal(f.render().props['data-controls-hidden'], undefined);
    assert.equal(f.document.activeElement, lastControl);
    assert.equal(dispatch('onKeyDown', key, true, code), true);
    t.mock.timers.tick(4000);
    assert.equal(f.render().props['data-controls-hidden'], undefined);
    assert.equal(dispatch('onKeyUp', key, false, code), true);
  }
  assert.equal(dispatch('onKeyDown', 'Enter'), false, 'a fresh activation is available');
  t.mock.timers.tick(3000);
  assert.equal(f.render().props['data-controls-hidden'], true);
  assert.equal(f.back(), true); assert.equal(f.closed(), 1);
});

test('browser resume seeks the real media and records only actual playback of the opened demo', () => {
  const checkpoints = [];
  const f = fixture({startPosition: 19, onCheckpoint: (...values) => checkpoints.push(values)});
  f.mount();
  const video = f.all().find(node => node.type === 'video').props;
  video.onLoadedMetadata({currentTarget: f.media});
  assert.equal(f.media.currentTime, 19);
  video.onTimeUpdate({currentTarget: f.media});
  assert.deepEqual(checkpoints, []);
  video.onPlaying();
  f.media.currentTime = 20; video.onTimeUpdate({currentTarget: f.media});
  f.media.currentTime = 24; video.onTimeUpdate({currentTarget: f.media});
  f.cleanup();
  assert.deepEqual(checkpoints, [[20,60,false],[24,60,false]]);
});

test('web player loader follows playback, waiting, pause and failure', () => {
  const f = fixture();
  const video = () => f.all().find(n => n.type === 'video').props;
  const loader = () => f.all().some(n => n.props.className === 'itar-player-loader');
  assert.equal(loader(), true);
  video().onPlaying(); f.render(); assert.equal(loader(), false);
  video().onWaiting(); f.render(); assert.equal(loader(), true);
  video().onPause(); f.render(); assert.equal(loader(), false);
  video().onWaiting(); video().onError(); f.render(); assert.equal(loader(), false);
});

test('autoplay advances to the next season when the last episode ends', () => {
  let started = 0;
  const f = fixture({autoNext: true, choices: {
    episodes: [], related: [], startsNextSeason: true,
    nextEpisode: {key: '2/1', title: 'S2 E1 · A new season', play: () => started++},
  }});
  assert.ok(f.find('Play next season · S2 E1 · A new season'));
  f.all().find(n => n.type === 'video').props.onEnded();
  assert.equal(started, 1);
});
