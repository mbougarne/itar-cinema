const {execFileSync, spawnSync} = require('node:child_process');
const {readFileSync, writeFileSync} = require('node:fs');
const path = require('node:path');

function wireProbeVideo(root) {
  const video = path.join(root, 'node_modules/react-native-video');
  const {version} = JSON.parse(readFileSync(path.join(video, 'package.json'), 'utf8'));
  if (version !== '6.19.3') throw new Error('Review the probe video patches for the selected version');

  // This wrapper is called only inside a worker, but lacks the annotation on
  // the overload it calls (upstream #4885). Preserve Android lint.
  const player = path.join(video, 'android/src/main/java/com/brentvatne/exoplayer/ReactExoplayerView.java');
  const source = readFileSync(player, 'utf8');
  const wrapper = '    private ArrayList<VideoTrack> getVideoTrackInfoFromManifest() {';
  if (source.split(wrapper).length !== 2) throw new Error('Unexpected video manifest-track wrapper');
  if (!source.includes(`    @WorkerThread\n${wrapper}`)) {
    writeFileSync(player, source.replace(wrapper, `    @WorkerThread\n${wrapper}`));
  }

  // v6.19.3 ignores viewType on Android. Only Cinema's inline preview asks
  // for a TextureView; the full-screen player retains Media3's SurfaceView.
  const patch = path.join(__dirname, 'patches/react-native-video-6.19.3-inline-texture.patch');
  const args = ['apply', '--no-index', '--whitespace=nowarn'];
  const options = {cwd: root, stdio: 'pipe'};
  if (spawnSync('git', [...args, '--reverse', '--check', patch], options).status === 0) return;
  execFileSync('git', [...args, patch], options);
}

module.exports = wireProbeVideo;
if (require.main === module) wireProbeVideo(path.resolve(process.argv[2] || path.join(__dirname, '..')));
