# Cinema screen designs

**English** · [العربية](README.ar.md)

These eleven reference images show the layout of Cinema’s sidebar, catalogues, search keyboard, settings and details. Open the [gallery](index.html) for the full-size images, or run the [example app](../docs/ott-app.md) to test navigation. The pictures use fictional, generated artwork. Their dimensions and checksums are in the [image manifest](screens.json).

- **Navigation.** The sidebar uses a marker for the current route and a separate outline for the focused control. Moving through the menu should leave the active page in place until the viewer selects another route.
- **Cards.** Give a card one focus target and an accessible title. Artwork and decorative skeletons belong inside the presentation. A white or cyan accent should remain visible over each background.
- **Changing content.** Keep loaded rows visible while fetching more. Make Retry reachable after a failure. When returning from Details, check which card actually receives focus after scrolling or recycling.

The gallery includes a [Home layout](screens/01-home.png), a [search results layout](screens/04-search.png), [Details](screens/07-details.png), an [empty search](screens/09-search-empty.png), a [loading state](screens/10-loading.png) and a [retry state](screens/11-error.png). For the running implementation, see [Cinema’s screens](../ott/src/).
