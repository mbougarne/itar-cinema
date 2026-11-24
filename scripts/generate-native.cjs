const { execFileSync } = require('node:child_process');
const { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const platforms = ['android', 'ios'];

for (const platform of platforms) {
  if (existsSync(path.join(root, platform))) {
    throw new Error(`A ${platform} project already exists. Preserve your native changes before regenerating.`);
  }
}

const scratch = mkdtempSync(path.join(tmpdir(), 'itar-cinema-'));
try {
  const project = path.join(scratch, 'ItarProbe');
  execFileSync('npx', [
    '--yes', '@react-native-community/cli@20.2.0', 'init', 'ItarProbe',
    '--template', '@react-native-tvos/template-tv@0.83.0-0',
    '--pm', 'npm', '--skip-install', '--skip-git-init', '--directory', project,
  ], { cwd: scratch, stdio: 'inherit' });

  const podfile = path.join(project, 'ios/Podfile');
  const contents = readFileSync(podfile, 'utf8');
  const anchor = '  use_react_native!(';

  if (!contents.includes(anchor)) throw new Error('Unexpected tvOS template.');
  writeFileSync(podfile, contents.replace(anchor,
    "  pod 'ItarEngineCore', :path => '../node_modules/@bougarnem/itar'\n\n" + anchor));

  require('./wire-probe-video.cjs')(root);

  for (const platform of platforms) {
    cpSync(path.join(project, platform), path.join(root, platform), { recursive: true });
  }

  const manifest = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  const xml = readFileSync(manifest, 'utf8');
  const internet = '<uses-permission android:name="android.permission.INTERNET" />';

  if (!xml.includes('android.permission.POST_NOTIFICATIONS')) {
    writeFileSync(manifest, xml.replace(internet,
      internet + '\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />'));
  }

  require('./wire-cinema-branding.cjs')(root);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
