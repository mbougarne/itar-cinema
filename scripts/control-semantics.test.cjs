const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {occurrenceKey} = require('@bougarnem/itar/web');

function load(file, imports) {
  const {outputText} = ts.transpileModule(readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  });
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, require: imports, __DEV__: false});
  return module.exports;
}
const nodes = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];

test('Cinema sidebar and icon controls keep one spoken name while presenting their own artwork', () => {
  const {accentThemes} = load('ott/src/styles.ts', () => ({StyleSheet: {create: styles => styles}}));
  let focused;
  const imports = name => {
    if (name.endsWith('/language')) return {useCinemaLanguage: () => ({language: 'en-US', rtl: false, t: value => value, toggle() {}})};
    if (name === 'react') return React;
    if (name === 'react-native') return {View: 'View', Text: 'Text', Image: 'Image'};
    if (name === '@bougarnem/itar/react') return {Focusable: 'Focusable', useIsFocused: key => key === focused};
    if (name.endsWith('/theme')) return {useDesign: () => ({s: {}, u: 1, colors: accentThemes.cyan})};
    if (name.endsWith('/tv-accessibility')) return load('ott/src/tv-accessibility.ts', () => ({Platform: {OS: 'android'}}));
    if (name === './Action') return {Action};
    throw new Error('Unexpected Cinema import ' + name);
  };
  const {Action} = load('ott/src/components/Action.tsx', imports);
  const {SidebarButton} = load('ott/src/components/SidebarButton.tsx', imports);
  const {IconAction} = load('ott/src/components/IconAction.tsx', imports);
  const props = {id: 'nav-profile', title: 'Explorer', label: 'Explorer, switch profile', icon: 1, avatar: true, onPress() {}};
  for (const expanded of [false, true]) {
    const host = Action(SidebarButton({...props, expanded}).props);
    assert.equal(host.props.accessibilityLabel, props.label);
    assert.equal(nodes(host).filter(node => node.type === 'Image').length, 1);
    assert.deepEqual(nodes(host).filter(node => node.type === 'Text').map(node => node.props.children),
      expanded ? ['Explorer'] : []);
  }
  const live = Action(SidebarButton({id: 'nav-live', title: 'Live TV', icon: 1, expanded: false, onPress() {}}).props);
  assert.equal(live.props.accessibilityLabel, 'Live TV');
  assert.deepEqual(nodes(live).filter(node => node.type === 'Text'), []);
  const like = Action(IconAction({id: 'like', icon: 1, label: 'Like', onPress() {}}).props);
  assert.equal(like.props.accessibilityLabel, 'Like');
  const play = {id: 'play', label: 'Play', primary: true, onPress() {}};
  const primary = Action(play);
  assert.equal(primary.props.baseAccentColor, '#07171C');
  assert.equal(primary.props.focusStyle.backgroundColor, '#00616F');
  assert.equal(primary.props.focusStyle.accentColor, '#FFFFFF');
  focused = play.id;
  assert.equal(Action(play).props.baseAccentColor, '#FFFFFF');
  assert.equal(like.props.focusStyle.accentColor, '#75F2FF');
  focused = 'like';
  assert.equal(Action(play).props.baseAccentColor, '#07171C');
  assert.equal(Action({id: 'like', label: 'Like', onPress() {}}).props.baseAccentColor, '#FFFFFF');
  assert.equal(nodes(like).filter(node => node.type === 'Image').length, 1);
});

for (const platform of ['android', 'web', 'ios']) {
  test(`${platform} settings expose truthful Boolean controls without changing commands`, () => {
    let presses = 0, toggles = 0, languageChanges = 0, accentChanges = 0, previewAudio = false, section = 'App settings';
    const navigation = platform === 'web' ? {enabled: true, toggle: () => toggles++} : null;
    const Settings = load('ott/src/Settings.tsx', name => {
      if (name.endsWith('/language')) return {useCinemaLanguage: () => ({language: 'en-US', rtl: false, t: value => value, toggle() { languageChanges++; }})};
      if (name === 'react') { return {...React, useEffect() {}, useContext: context => context.value, useMemo: callback => callback(), useCallback: callback => callback, useState: initial => [typeof initial === 'number' ? 800 : section, () => {}]}; }
      if (name === 'react-native') { return {Platform: {OS: platform}, Text: 'Text', View: 'View', useWindowDimensions: () => ({width: 1920})}; }
      if (name === '@bougarnem/itar/react') { return {occurrenceKey, FocusVirtualizedRails: 'Rails'}; }
      if (name === './preview-audio') return {usePreviewAudio: () => ({
        enabled: previewAudio, toggle: () => { previewAudio = !previewAudio; },
      })};
      if (name === './browser-navigation') { return {BrowserNavigation: {value: navigation}}; }
      if (name === './development-settings') { return {DevelopmentSettings: {value: null}}; }
      if (name === './theme') { return {useDesign: () => ({s: {}, u: 1, colors: {muted: '#BDC8D3', focus: '#26D9F2', accent: '#98BFFF', panel: '#142131', outline: '#52616E', selection: '#285568', track: '#334B60', raised: '#1D2C3C', focusFill: '#176B7B', actionRing: '#FFFFFF', playerFocus: '#29465F', playerHover: '#B9D5FF'}, accentName: 'cyan', toggleAccent: () => accentChanges++})}; }
      if (name === './artwork') return {icons: {}};
      return {};
    }).Settings;
    const render = () => Settings({id: 'settings', contrast: true, slow: false, armed: true, mode: 'fixture',
      onContrast: () => presses++, onSlow() {}, onArm() {}, onMode() {}});
    const itemsFor = name => {
      section = name;
      return nodes(render()).find(node => node.type === 'Rails').props.rails.map(row => row.items[0]);
    };
    const items = itemsFor('App settings');
    assert.equal(items.length, platform === 'web' ? 7 : 5);
    const sound = items.find(item => item.accessibilityLabel.startsWith('Preview video audio'));
    assert.ok(sound);
    assert.equal(sound.accessibilityRole, platform === 'ios' ? undefined : 'switch');
    if (platform !== 'ios') assert.equal(sound.accessibilityState.checked, false);
    sound.onPress();
    if (platform !== 'ios') {
      assert.equal(itemsFor('App settings').find(item => item.accessibilityLabel === 'Preview video audio').accessibilityState.checked, true);
    }
    if (platform === 'web') {
      const keyboard = items.find(item => item.accessibilityLabel === 'TV arrow-key navigation');
      const language = items.find(item => item.accessibilityLabel === 'Interface language: English');
      assert.ok(language);
      assert.equal(language.accessibilityRole, undefined);
      language.onPress();
      assert.equal(languageChanges, 1);
      assert.equal(keyboard.accessibilityLabel, 'TV arrow-key navigation');
      assert.equal(keyboard.accessibilityRole, 'switch');
      assert.equal(keyboard.accessibilityState.checked, true);
      keyboard.onPress();
      assert.equal(toggles, 1);
    }
    const accent = items.find(item => item.accessibilityLabel === 'Accent color: Cinema cyan');
    assert.ok(accent);
    assert.equal(accent.accessibilityRole, undefined);
    accent.onPress(); assert.equal(accentChanges, 1);
    const contrast = items[1];
    contrast.onPress(); assert.equal(presses, 1);
    const [slow, armed] = itemsFor('Diagnostics');
    for (const [item, checked] of [[contrast, true], [slow, false], [armed, true]]) {
      assert.equal(item.accessibilityRole, platform === 'ios' ? undefined : 'switch');
      if (platform !== 'ios') assert.equal(item.accessibilityState.checked, checked);
    }
    const [source] = itemsFor('Content source');
    assert.equal(source.accessibilityRole, undefined);
    assert.equal(source.accessibilityLabel, 'Catalogue: Offline fixtures');
  });
}
