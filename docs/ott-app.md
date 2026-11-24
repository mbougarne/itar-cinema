# Run and explore Itar Cinema

[العربية](ar/ott-app.md)

Cinema is the example app in [the Cinema repository](../README.md). It uses the same public components you would import in a TV app. Use it to follow focus from a sidebar into a catalogue, move to a cell that has not mounted yet, open Details and return to the card that opened it.

## Start the app

| Runtime | Entry point |
| --- | --- |
| Desktop browser | Follow the [web build instructions](../README.md#run-in-a-browser). Run `npm run web` and open `http://127.0.0.1:8081`. |
| Android TV / Google TV / Fire OS | Generate the native shell, start Metro, then build for the selected Android target. [Android guide](../README.md#tv-builds) |
| tvOS | Generate the native shell, install pods, then launch the tvOS scheme on the selected simulator or paired TV. [Apple TV guide](../README.md#tv-builds) |
| Samsung Tizen / LG webOS | Build the platform-specific staging directory, then package and install through that TV's SDK. [Web TV guide](../README.md#tv-builds) |

On the welcome screen, choose **Sign in**, submit the demo form and select **Explorer** or **Stargazer**, or create a local profile with a name and avatar. Use **Settings → App settings → Manage profiles** to change either or enable automatic next-episode playback. The sign-in form works with empty fields. There is no account service. On the web, a local record remembers the profile, demo sign-in and catalogue source across reloads. Sign out to clear it.

A new browser session starts with offline fixtures. Native builds initially look for a local metadata proxy. To run on a TV without a backend, open **Settings → Content source → Catalogue** and select **Offline fixtures**. Settings also offers a slow request and a forced failure for testing focus while content changes. For mock or live metadata through the proxy, use the [catalogue proxy guide](tmdb-proxy.md). Every title's Play action opens a credited sample film. [Demo playback](#demo-playback)

### Launcher and splash assets

The native shell generator applies the Cinema branding automatically. Run `node scripts/wire-cinema-branding.cjs android` or `node scripts/wire-cinema-branding.cjs ios` to refresh an existing generated shell. The Android TV resources also apply to Android-based Fire TV builds. The Tizen and webOS builds package their respective icons automatically.

The [branding directory](../ott/assets/branding/) also contains artwork for the Fire TV Appstore, Samsung Seller Office and LG Seller Lounge. [Fire TV artwork](https://www.developer.amazon.com/docs/app-submission/add-store-listing-information) · [Samsung app icons](https://developer.samsung.com/smarttv/design/app-icons-and-screenshots.html) · [LG app resources](https://webostv.developer.lge.com/develop/getting-started/app-resources)

## Follow a focus interaction

| Try this | What to observe | Implementation |
| --- | --- | --- |
| On Home, move right several cards in **Popular stories**, then press Down. In **Worth exploring**, move right to the end, then left to the first card and press Left again. | The first visit starts on the first eligible card. Go back up to return to the card you left (`rowEntry="remembered"`). Cards slide through the leading focus position, including the final card (`horizontalAlignment="pinned"`). Left from the first card opens the sidebar. | [Browse](../ott/src/Browse.tsx) · [collection options](guides/collections.md) |
| Open a nonfirst card, then return from Details. | Compare the final highlighted occurrence and scroll position with the card you activated. A repeated movie in another rail gives this check a useful control. | [Cinema route state](../ott/src/Cinema.tsx) · [Details](../ott/src/Details.tsx) |
| Search with the on-screen keyboard, clear the last character and move again. | Observe the new target when the selected action becomes unavailable. On web, repeat using Tab and a pointer. | [Search](../ott/src/Search.tsx) |
| Change the focus accent in **Settings → App settings**. In **Diagnostics**, enable slow requests and queue a failure, then browse again. | Follow focus through loading, error, Retry and successful publication. Compare observations with the reader on and off. | [Settings](../ott/src/Settings.tsx) · [catalogue session](../ott/src/session.ts) |


## Series playback walkthrough

Open **Series → Black Mirror** when using the live TMDB proxy. From **Play demo**, go Down to **Episodes**, Down to the season picker, Right to **Season 2** and Select. Go Down to the episodes and open **White Bear**. The player shows *Sintel* and the selected episode as context. The player shows **Play next** above the timeline and the other episodes from that season below it. The movie player offers similar titles. Both suggestion rails skip the currently playing item. At the end of a season, **Play next season** opens the first episode of the next available season. Profiles with autoplay enabled advance there automatically. Press Back from the player and observe focus on the episode that opened it, even after switching videos. Press Back again to return to the **Black Mirror** catalogue card. For the same route offline, open any fixture series. **Specials** is empty and the second episode has no still. Enable **Slow requests** in Settings to exercise the episode loading state.

## The Home slider and local library

The featured hero fills the Home viewport. Focus Play or a thumbnail to see an excerpt from the assigned open film. Previews are muted by default. Turn on **Settings → App settings → Preview video audio** to hear the film's audio when the browser or TV allows it. Each excerpt runs for up to ten seconds and starts at about 00:30 in the source. The carousel advances automatically when available and respects the reduced-motion preference. The Open films shelf expands the focused slice and plays the matching excerpt. Top 10 cards scroll only as needed to reveal the focused poster.

On Details, add or remove a title with **My List**. Play the demo for a title and leave partway through to see its artwork and progress in **Continue watching** on Home. Both lists belong to the current profile on this device. The card uses the TMDB title logo when one is available.

In **Preview picks**, leave focus on a card to expand it and play a ten-second excerpt from *Big Buck Bunny*. Cinema includes the 360p preview clip so it can play offline. Leaving the card stops the preview. Preview playback leaves the saved viewing position alone.

## Demo playback

**Play demo** opens one of three Blender Foundation open films. Black Mirror uses *Sintel*, The Odyssey uses *Tears of Steel*, and other titles follow a stable selection. **Open films** on Home plays each full film under its own name. The player names and credits the video it opens. The 4K badge refers to the verified 2160p browser source for *Big Buck Bunny*. The crossed-out AD badge indicates an unavailable audio-description track. The age rating refers to the catalogue title. [Film sources and credits](../ott/assets/cinematic/open-films.md)

## Cast, reviews and charts

Black Mirror offers a repeatable cast path. Open **More like this → The Twilight Zone → Cast & crew → Jordan Peele**. The person screen shows a biography, department, birth details, aliases and known credits when the provider has them. Open a credit, then press Back through the credit card, cast card and recommendation. Select **Reviews** on a movie or series to read as many as ten TMDB reviews. Select a review to read it, then Select again to move through longer reviews or close it. Offline titles cover empty, single-review and multiple-review states.

Home’s two **Top 10** rails rank movies and series in the order they appear in the same TMDB weekly trending feed. The fixture source uses the same rail layout with locally authored titles.

## Collections and Kids

**Collections** has nine illustrated selections with item counts, title-based heroes and a grid of the selected collection’s stories. **Kids** includes a featured title, age-group filters, six bundled animated previews and the full *Big Buck Bunny*. The Movies and Series catalogues include alphabetical sorting, newest releases and extra genre filters.

## Live TV, Sports and the guide

**Live TV** reads a curated M3U selection from IPTV-org. Cinema’s player loads the selected broadcaster’s HLS URL. Web builds use HLS.js where Media Source Extensions are supported and built-in HLS otherwise. Native TV builds pass the HLS source to the native player. Home’s **Live channels** and **TV guide** tune a live channel. **TV guide** on the Live TV screen opens the existing programme guide. [IPTV-org playlist and source notes](https://github.com/iptv-org/iptv#legal)

**Sports** has World Cup 2026 fixtures and final scores, plus a separate athletics replay. Select a result to see its venue and kickoff in UTC. The pinned archive has no upcoming events or live status feed. [Results and video sources](../ott/assets/sports/sources.md)

Choose **Offline fixtures**, then select **Live TV → TV guide** to exercise sample channels without a provider. Select a programme and choose **Tune sample channel** to play the bundled athletics clip. Back restores the programme. Leaving that programme selected holds the visible time window while the **on now** marker advances. The existing EPGTalk schedule is available in proxy mode.

The European Commission publishes the EBS schedule in Central European time and provides a corporate web embed. The documented embed opened in Chrome but reported a manifest-load error for the EBS feed. The Commission’s CC BY 4.0 terms apply to material it owns and exclude third-party components. Direct player compatibility and reuse of the continuous feed and schedule remain unverified. [EBS technical information](https://audiovisual.ec.europa.eu/en/about-ebs) · [Audiovisual conditions of use](https://audiovisual.ec.europa.eu/en/conditions-of-use)

## Work on the example

- The [app entry](../App.tsx) selects Cinema or the development probes. The [Cinema entry](../ott/App.tsx) provides the design theme. Shared route state lives in [Cinema](../ott/src/Cinema.tsx).
- Screens and the sidebar live under [ott/src](../ott/src/). Shared controls live in [components](../ott/src/components/). Artwork, shared data types, catalogue sessions, styles and viewport calculations have separate modules.
- The [web media player](../ott/src/Player.web.tsx) sits beside the [native player](../ott/src/Player.tsx). The [browser adapter](../web/) resolves `@bougarnem/itar/react` to the npm package’s `@bougarnem/itar/web` entry. Native builds use the package's Fabric components.
- Run `npm run check` to check lint and formatting, `npm run typecheck` for native TypeScript and `npm run typecheck:web` for the browser entry. From a fresh checkout run `npm run build` before `npm test`. [Setup](../README.md)

The [design pack](../design/README.md) describes the layouts and credits the original fictional artwork. See the [Itar device guides](https://github.com/mbougarne/itar/tree/main/docs/devices) for current hardware observations.
