/* eslint-env node, es2022 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');

const { defaultProxyURL, proxyURL } = require('../scripts/tmdb-endpoint.cjs');

const root = path.resolve(__dirname, '..');
const targets = ['browser', 'tizen', 'webos'];

const branding = path.join(root, 'ott/assets/branding');

function webPlugins(outdir) {
  return [
    {
      name: 'probe-web-boundaries',
      setup(build) {
        build.onResolve({ filter: /^react-native$/ }, () => ({
          path: path.join(__dirname, 'platform.ts'),
        }));

        build.onResolve({ filter: /^@bougarnem\/itar\/react$/ }, () =>
          build.resolve('@bougarnem/itar/web', {
            resolveDir: root,
            kind: 'import-statement',
          }),
        );

        build.onLoad({ filter: /\.(?:png|jpe?g|svg|mp4)$/ }, args => {
          const bytes = fs.readFileSync(args.path);

          const name =
            crypto
              .createHash('sha256')
              .update(bytes)
              .digest('hex')
              .slice(0, 16) + path.extname(args.path);

          fs.mkdirSync(path.join(outdir, 'assets'), { recursive: true });
          fs.writeFileSync(path.join(outdir, 'assets', name), bytes);

          return {
            loader: 'js',
            contents: `module.exports = {uri: ${JSON.stringify(
              `./assets/${name}`,
            )}};`,
          };
        });
      },
    },
  ];
}

function writeShell(target, outdir, endpoint = defaultProxyURL) {
  if (!targets.includes(target)) {
    throw new Error(`Unknown web target: ${target}`);
  }

  fs.copyFileSync(
    path.join(__dirname, 'index.html'),
    path.join(outdir, 'index.html'),
  );

  fs.copyFileSync(
    path.join(
      branding,
      target === 'tizen' ? 'samsung/icon-117.png' : 'lg/icon-80.png',
    ),
    path.join(outdir, 'icon.png'),
  );

  fs.copyFileSync(
    path.join(branding, 'cinema-mark.png'),
    path.join(outdir, 'brand.png'),
  );

  if (target === 'tizen') {
    fs.writeFileSync(
      path.join(outdir, 'config.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>
<widget xmlns="http://www.w3.org/ns/widgets" xmlns:tizen="http://tizen.org/ns/widgets" id="https://itar.dev/probe" version="1.0.0" viewmodes="maximized">
  <tizen:application id="ItarCinema.Probe" package="ItarCinema" required_version="6.5"/>
  <content src="index.html"/><name>Itar Cinema</name><icon src="icon.png"/>
  <feature name="http://tizen.org/feature/screen.size.all"/>
  <tizen:profile name="tv-samsung"/>
  <tizen:privilege name="http://tizen.org/privilege/internet"/>
  <access origin="https://kodi.mirror.garr.it" subdomains="false"/>
  <access origin="https://archive.org" subdomains="true"/>
  <access origin="https://getaj.net" subdomains="true"/>
  <access origin="https://france24.com" subdomains="true"/>
  <access origin="https://skynewsarabia.com" subdomains="true"/>
  <access origin="https://akamaized.net" subdomains="true"/>
  <access origin="https://pbskids.org" subdomains="true"/>
  <access origin="https://wurl.com" subdomains="true"/>
  <access origin="https://wurl.tv" subdomains="true"/>
  <access origin="https://amagi.tv" subdomains="true"/>
  <access origin="https://bozztv.com" subdomains="true"/>
  <access origin="https://cloudfront.net" subdomains="true"/>
  <access origin="https://image.tmdb.org" subdomains="false"/>${
    endpoint === defaultProxyURL
      ? ''
      : `\n  <access origin="${endpoint}" subdomains="false"/>`
  }
  <access origin="https://epgtalk.com" subdomains="false"/>
  <tizen:setting screen-orientation="landscape" context-menu="disable" background-support="disable" encryption="disable" install-location="auto" hwkey-event="enable"/>
</widget>
`,
    );
  }

  if (target === 'webos') {
    fs.copyFileSync(
      path.join(branding, 'lg/icon-130.png'),
      path.join(outdir, 'large-icon.png'),
    );

    fs.copyFileSync(
      path.join(branding, 'lg/splash.png'),
      path.join(outdir, 'splash.png'),
    );

    fs.writeFileSync(
      path.join(outdir, 'appinfo.json'),
      JSON.stringify(
        {
          id: 'com.itar.probe',
          version: '1.0.0',
          vendor: 'Itar',
          type: 'web',
          main: 'index.html',
          title: 'Itar Cinema',
          icon: 'icon.png',
          largeIcon: 'large-icon.png',
          splashBackground: 'splash.png',
          resolution: '1920x1080',
          disableBackHistoryAPI: true,
          accessibility: { supportsAudioGuidance: true },
        },
        null,
        2,
      ) + '\n',
    );
  }
}

async function buildSite(target = 'browser') {
  if (!targets.includes(target)) {
    throw new Error(`Use one of: ${targets.join(', ')}`);
  }

  const endpoint =
    target !== 'browser'
      ? proxyURL(process.env.ITAR_TMDB_PROXY_URL)
      : defaultProxyURL;

  const outdir = path.join(root, 'build/web', target);

  fs.rmSync(outdir, { recursive: true, force: true });
  fs.mkdirSync(outdir, { recursive: true });

  const result = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [path.join(__dirname, 'index.tsx')],
    outdir,
    entryNames: 'app',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome85'],
    define: {
      __DEV__: 'false',
      'process.env.NODE_ENV': '"production"',
      'process.env.ITAR_TMDB_PROXY_URL': JSON.stringify(endpoint),
    },
    minify: true,
    metafile: true,
    legalComments: 'eof',
    plugins: webPlugins(outdir),
    resolveExtensions: [
      '.web.tsx',
      '.web.ts',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
    loader: { '.wasm': 'binary' },
    assetNames: 'assets/[name]-[hash]',
  });

  const inputs = Object.keys(result.metafile.inputs).sort();

  const installedAdapter = path.relative(
    root,
    require.resolve('@bougarnem/itar/web'),
  );

  if (!inputs.includes(installedAdapter)) {
    throw new Error('Cinema must bundle the installed Itar web adapter.');
  }

  writeShell(target, outdir, endpoint);

  fs.writeFileSync(
    path.join(outdir, 'build-manifest.json'),
    JSON.stringify(
      {
        target,
        engine: 'C++20/Wasm',
        javascriptTarget: 'chrome85',
        deviceAcceptance: 'NOT RUN',
        itarVersion: require('@bougarnem/itar/package.json').version,
        inputs,
      },
      null,
      2,
    ) + '\n',
  );

  console.info(
    `Built ${target}: ${path.relative(root, outdir)}${
      target === 'browser' ? '' : ' (unsigned staging directory)'
    }`,
  );

  return outdir;
}

module.exports = { buildSite, webPlugins, writeShell };

if (require.main === module) {
  buildSite(process.argv[2]).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
