const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = readFileSync(path.join(__dirname, '../ott/src/Auth.tsx'), 'utf8');
const {outputText} = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
});

// Exercise real handlers and effect dependencies; native reader/window behavior
// remains an emulator/device check rather than a property of this hook harness.
function fixture(platform) {
  const states = [], refs = [], effects = [], pending = [], requests = [], keyboard = new Map(), menuRoutes = [];
  const nativeTouchable = {Ripple: (color, borderless) => ({type: 'RippleAndroid', color, borderless})};
  let stateIndex = 0, refIndex = 0, effectIndex = 0, tree, focusCalls = 0, signIns = 0, back;
  const commands = {focusByKey: key => { requests.push(key); return {cancel() {}}; }};
  const react = {
    createElement: (type, props, ...children) => ({type, props: {...props, children: children.flat(Infinity)}}),
    useContext: context => context,
    useState: initial => {
      const i = stateIndex++;
      if (!(i in states)) { states[i] = initial; }
      return [states[i], value => { states[i] = value; }];
    },
    useRef: initial => { const i = refIndex++; refs[i] ||= {current: initial}; return refs[i]; },
    useEffect: (callback, deps) => {
      const i = effectIndex++, previous = effects[i];
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
        pending.push(() => { previous?.cleanup?.(); effects[i] = {deps, cleanup: callback()}; });
      }
    },
  };
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, require: name => {
    if (name === './language') return {useCinemaLanguage: () => ({t: value => value})};
    if (name === './tv-accessibility') return {captionAccessible: platform === 'ios' ? false : undefined};
    if (name === 'react') { return react; }
    if (name === './browser-navigation') { return {BrowserNavigation: platform === 'web' ? {enabled: true} : null}; }
    if (name === 'react-native') {
      return {Platform: {OS: platform}, View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableNativeFeedback: nativeTouchable,
        Keyboard: {addListener: (event, callback) => { keyboard.set(event, callback); return {remove: () => keyboard.delete(event)}; }},
        BackHandler: {addEventListener: (_, callback) => { back = callback; return {remove: () => { back = null; }}; }}};
    }
    if (name === '@bougarnem/itar/react') { return {FocusScope: 'FocusScope', occurrenceKey: (...parts) => parts.join('/'), useFocusReady: () => true, useScreenReaderEnabled: () => false, useFocusCommands: () => commands}; }
    if (name === './components/Action') { return {Action: 'Action'}; }
    if (name === './useAppleTVMenu') { return {useAppleTVMenu: active => menuRoutes.push(active)}; }
    if (name === './theme') { return {useDesign: () => ({s: {}, u: 1})}; }
    throw new Error(`Unexpected import ${name}`);
  }});
  const nodes = node => !node?.props ? [] : [node, ...node.props.children.flatMap(nodes)];
  const render = () => {
    stateIndex = refIndex = effectIndex = 0;
    tree = module.exports.default({onSignIn: () => signIns++});
    for (const node of nodes(tree)) {
      if (node.type === 'TextInput' && node.props.ref) { node.props.ref.current = {focus: () => focusCalls++}; }
    }
    pending.splice(0).forEach(run => run());
  };
  render();
  const find = (type, label) => nodes(tree).find(node => node.type === (type === 'TouchableNativeFeedback' ? nativeTouchable : type) &&
    (!label || (node.props.label ?? node.props.accessibilityLabel ?? node.props.title) === label));
  find('Action', 'Sign in').props.onPress(); render();
  return {render, find, requests, keyboard, menuRoutes, focusCalls: () => focusCalls, signIns: () => signIns, back: () => back?.(),
    inputs: () => nodes(tree).filter(node => node.type === 'TextInput'),
    activate: field => { find('Action', `Edit ${field}`).props.onPress(); render(); }};
}

test('Android keeps both native fields mounted through typing, blur, Done and keyboard hiding', () => {
  const f = fixture('android');
  assert.deepEqual(f.requests, ['auth/signin'], 'native form entry issues no engine field request');
  assert.equal(f.find('Action'), undefined, 'form buttons must also yield to native navigation');
  for (const field of ['Email', 'Password']) {
    const editor = f.find('TextInput', field);
    assert.equal(editor.props.autoFocus, undefined);
    assert.equal(editor.props.showSoftInputOnFocus, undefined);
    assert.equal(editor.props.secureTextEntry, field === 'Password');
    assert.equal(editor.props.submitBehavior, 'blurAndSubmit');
    editor.props.onChangeText(`${field} draft`); f.render();
    f.find('TextInput', field).props.onBlur?.();
    f.find('TextInput', field).props.onSubmitEditing?.();
    f.keyboard.get('keyboardDidHide')?.(); f.render();
    assert.equal(f.inputs().length, 2);
    assert.equal(f.find('TextInput', field).props.ref, editor.props.ref, 'field identity is retained');
    assert.equal(f.find('TextInput', field).props.value, `${field} draft`);
  }
  assert.equal(f.focusCalls(), 0);
  assert.deepEqual(f.requests, ['auth/signin']);
  for (const label of ['Sign in', 'Back']) {
    const action = f.find('TouchableNativeFeedback', label);
    assert.equal(action.props.accessibilityRole, 'button');
    assert.equal(action.props.useForeground, true, 'native feedback must draw above the colored child');
    assert.equal(action.props.background.type, 'RippleAndroid');
    assert.equal(action.props.onFocus, undefined, 'focus visuals must not wait for JavaScript');
  }
  f.find('TouchableNativeFeedback', 'Sign in').props.onPress();
  assert.equal(f.signIns(), 1);
  f.find('TouchableNativeFeedback', 'Back').props.onPress(); f.render();
  assert.equal(f.inputs().length, 0);
  f.find('Action', 'Sign up').props.onPress(); f.render();
  assert.ok(f.find('TouchableNativeFeedback', 'Sign up'));
  assert.equal(f.find('TextInput', 'Email').props.value, 'Email draft');
  assert.equal(f.back(), true); f.render();
  assert.equal(f.inputs().length, 0);
});

test('Android form maps the accessibility activate action to Sign in, Back and Sign up', () => {
  const f = fixture('android');
  const activate = (button, name = 'activate') => {
    assert.deepEqual(Array.from(button.props.accessibilityActions ?? [], action => action.name), ['activate']);
    button.props.onAccessibilityAction({nativeEvent: {actionName: name}});
  };
  const submit = f.find('TouchableNativeFeedback', 'Sign in');
  activate(submit, 'longpress');
  assert.equal(f.signIns(), 0);
  activate(submit);
  assert.equal(f.signIns(), 1);
  activate(f.find('TouchableNativeFeedback', 'Back')); f.render();
  assert.equal(f.inputs().length, 0);
  f.find('Action', 'Sign up').props.onPress(); f.render();
  activate(f.find('TouchableNativeFeedback', 'Sign up'));
  assert.equal(f.signIns(), 2);
});

for (const platform of ['ios', 'web']) {
  test(`${platform} retains its inline editor and keyboard-hide completion`, () => {
    const f = fixture(platform);
    f.activate('email');
    assert.equal(f.find('TouchableNativeFeedback'), undefined);
    assert.equal(f.find('Action', 'Edit email'), undefined);
    assert.equal(f.focusCalls(), 1);
    f.find('TextInput').props.onChangeText('example'); f.render();
    f.keyboard.get('keyboardDidHide')(); f.render();
    assert.equal(f.find('TextInput'), undefined);
    assert.equal(f.find('Action', 'Edit email').props.displayLabel, 'example');
    assert.equal(f.requests.at(-1), 'auth/email');
  });
}

test('Welcome yields Menu, and the sign-in form and inline editor provide their own Back routes', () => {
  const f = fixture('ios');
  assert.deepEqual(f.menuRoutes, [false, true]);
  f.activate('email');
  assert.equal(f.menuRoutes.at(-1), true);
  assert.equal(f.back(), true); f.render();
  assert.equal(f.menuRoutes.at(-1), true, 'the form remains after the editor closes');
  assert.equal(f.back(), true); f.render();
  assert.equal(f.menuRoutes.at(-1), false, 'tvOS can leave from Welcome');
});

test('Samsung Done returns to the current editor action and leaves submission to the user', () => {
  const f = fixture('web');
  for (const field of ['email', 'password']) {
    f.activate(field);
    f.find('TextInput').props.onKeyPress({nativeEvent: {key: 'Unidentified', keyCode: 65376}});
    f.render();
    assert.equal(f.requests.at(-1), 'auth/' + field);
    assert.equal(f.signIns(), 0);
  }
  f.find('Action', 'Sign in').props.onPress();
  assert.equal(f.signIns(), 1);
});
