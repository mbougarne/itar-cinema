# Use TMDB in Itar Cinema

[العربية](ar/tmdb-proxy.md)

Cinema has three catalogue options. **Offline fixtures** use bundled fictional films and work without a server. The **TMDB proxy** setting talks to a local Node server. That server can return mock data or use your TMDB v3 API key to fetch live catalogue, search, title, cast and biography data.

## Run the browser demo with TMDB

Use Node 22.23.4. In the repository root, put your own v3 key in the ignored `.env` file under `MOVIE_DATABASE_API_KEY`. The tracked [.env.example](../.env.example) shows the format. Keep the real value in the backend file. The server reads it only when you explicitly enable live mode.

1. Start the server in one terminal:

   ```sh
   npm run tmdb:proxy -- --live --allow-tmdb-key-use --allow-web
   ```

2. In another terminal, verify the server mode and start the [browser demo](../README.md#run-in-a-browser):

   ```sh
   curl http://127.0.0.1:8789/health
   npm run web
   ```

3. Open `http://127.0.0.1:8081`, submit the demo sign-in, choose a profile and select **Settings → Content source → Catalogue → TMDB proxy**. Return to Home to see the catalogue. A health response containing `"mode":"live"` confirms the server mode. A loaded title and its artwork confirm the catalogue request worked.

The backend sends read-only queries to `api.themoviedb.org` with the v3 key. Search text and title/person IDs are sent with the corresponding requests. The browser receives public metadata and loads artwork from `image.tmdb.org`. The server binds to `127.0.0.1:8789`. The `--allow-web` flag admits only the two demo origins on port 8081, `http://127.0.0.1` and `http://localhost`. Stop the process with Ctrl+C when finished. [Proxy implementation](../scripts/tmdb-proxy.cjs)

## Try the HTTP path without a key

```sh
node scripts/tmdb-proxy.cjs --allow-web
```

Use the same **TMDB proxy** setting. The mock server serves local sample data and artwork, leaves `.env` unread and reports `"mode":"mock"` at `/health`. For a native emulator or simulator, omit `--allow-web`. Android can reach the host loopback using `adb -s YOUR_ADB_SERIAL reverse tcp:8789 tcp:8789` on the selected device.

## Reach the proxy from a physical native TV

A TV's loopback address points back to the TV. On a trusted private IPv4 network, keep the live backend on loopback and start the device gateway separately. Replace the first address with the development machine's private IP and the second with the TV's private IP.

```sh
node scripts/tmdb-device-gateway.cjs 192.168.1.10 192.168.1.20
```

The gateway binds to the first address on port 8788, accepts requests from the named TV and forwards the allowed GET routes to the local backend. Set `ITAR_TMDB_PROXY_URL=http://192.168.1.10:8788` for the **native build** and rebuild the app. Only the public origin is compiled into the client. Generated Xcode builds can receive the value as a build setting. Rebuild if the machine's address changes. Mock artwork uses loopback URLs, so choose offline fixtures for an entirely local hardware test. Packaged web-TV builds do not use this native override. [Gateway](../scripts/tmdb-device-gateway.cjs) · [TV builds](../README.md#tv-builds)

TMDB supplies metadata and artwork. Cinema's player streams a separately credited sample film. Consult TMDB's attribution and usage guidance before distributing a live integration. [TMDB authentication](https://developer.themoviedb.org/docs/authentication-application) · [Image URLs](https://developer.themoviedb.org/docs/image-basics) · [Attribution](https://developer.themoviedb.org/docs/faq) · [Demo playback](ott-app.md#demo-playback)

Series Details requests the show's season list and networks. Cinema loads each selected season through `/v1/season`, including season `0` when TMDB lists specials, and temporarily caches visited seasons in memory. The approved short TMDB logo and notice appear in the **Credits** section of Settings. [TMDB season details](https://developer.themoviedb.org/reference/tv-season-details) · [Logo source](https://www.themoviedb.org/about/logos-attribution)

Cinema requests `/v1/reviews` when opening the Reviews tab. It collects up to ten unique English-language reviews across up to five provider pages. The `/v1/person` route fetches biographical facts and combined movie and TV credits when Cinema opens a cast card. Both responses use the existing local proxy and bounded in-memory caches. [Movie reviews](https://developer.themoviedb.org/reference/movie-reviews) · [TV reviews](https://developer.themoviedb.org/reference/tv-series-reviews) · [Combined credits](https://developer.themoviedb.org/reference/person-combined-credits)

Movies and Series can combine genre filters with alphabetical order or newest releases. The pagination cursor includes the selected sort so a later page cannot accidentally use a different order. TMDB exposes release and first-air dates for the newest order. [Movie discovery](https://developer.themoviedb.org/reference/discover-movie) · [TV discovery](https://developer.themoviedb.org/reference/discover-tv)
