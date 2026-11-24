# Itar Cinema

Itar Cinema is a standalone TV app that demonstrates focus navigation with the published [`@bougarnem/itar` npm package](https://www.npmjs.com/package/@bougarnem/itar). It supports a local fixture catalogue, TMDB metadata, and credited open-film demo streams.

[Watch the Cinema demo](docs/images/itar-cinema-preview.mp4).

## Run in a browser

Use Node 22.23.4 and npm 10.9.9, then run:

```sh
npm ci
npm run web
```

Open [http://127.0.0.1:8081](http://127.0.0.1:8081), choose **Sign in**, submit the demo form, and select a profile. The offline catalogue works without a TMDB key. Use arrow keys and Enter as a TV remote, and Escape to go Back.

## TV builds

- **Android TV and Fire OS** run `npm run native:generate`, start Metro with `npm start`, then run `npm run android -- --no-packager` with a connected device.
- **Apple TV** run `npm run native:generate` once, install the pods in `ios` with `pod install`, then open `ios/ItarProbe.xcworkspace` or run `npm run tvos -- --udid YOUR_TVOS_UDID`.
- **Samsung Tizen and LG webOS** run `npm run build:tizen` or `npm run build:webos`. The unsigned staging directory is under `build/web/`. Package and sign it with your device SDK.

The app uses `@bougarnem/itar/react` on native TVs and `@bougarnem/itar/web` in browser and web TV builds. The web dependency supplies its own Wasm engine. Cinema composes public Itar rails to render shelves with different heights on the current beta.

See the [app walkthrough](docs/ott-app.md) and [TMDB setup](docs/tmdb-proxy.md). Run `npm test`, `npm run typecheck`, and `npm run typecheck:web` for local checks.
