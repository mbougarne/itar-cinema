// The pinned TV list omits its native FocusEvent import in its declaration.
// Its Flow implementation imports the native type. Node's Event globals make
// the declaration's accidental global FocusEvent incompatible with native View.
// Correct an owned type-only copy; never mutate a shared dependency installation.
const {cpSync, mkdirSync, readFileSync, rmSync, writeFileSync} = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const rn = path.dirname(require.resolve('react-native/package.json'));
const manifest = require.resolve('@react-native-tvos/virtualized-lists/package.json', {paths: [rn]});
const source = path.dirname(manifest);
const version = JSON.parse(readFileSync(manifest, 'utf8')).version;
if (version !== '0.83.0-0') { throw new Error(`Review the native FocusEvent correction for TV lists ${version}`); }
const declaration = path.join('Lists', 'VirtualizedList.d.ts');
const text = readFileSync(path.join(source, declaration), 'utf8');
const before = "import type {\n  StyleProp,";
if (text.split(before).length !== 2 || !text.includes('onFocusCapture?: ((event: FocusEvent) => void)')) {
  throw new Error('TV list declaration changed; review the FocusEvent import before applying the correction');
}
const destination = path.join(root, 'build', 'tv-types', 'virtualized-lists');
mkdirSync(path.dirname(destination), {recursive: true});
rmSync(destination, {recursive: true, force: true});
cpSync(source, destination, {recursive: true});
writeFileSync(path.join(destination, declaration), text.replace(before, "import type {\n  FocusEvent,\n  StyleProp,"));
