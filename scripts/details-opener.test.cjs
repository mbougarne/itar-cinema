const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function evaluate(file, imports, globals = {}) {
  const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true},
  });
  const module = {exports: {}};
  vm.runInNewContext(outputText, {module, exports: module.exports, require: imports, ...globals});
  return module.exports;
}
const {occurrenceKey} = require('@bougarnem/itar/web');
const {createStyles} = evaluate('ott/src/styles.ts', () => ({StyleSheet: {create: styles => styles}}));
const cinemaStyles = createStyles(1);
const film = {id: 'title-b', title: 'Title B', kind: 'movie', year: 2026, category: 'Drama', synopsis: '', art: 0};
const recommendation = {...film, id: 'title-c', title: 'Title C'};
const castMember = {id: 'cast-a', name: 'Actor A', role: 'Lead'};
const catalogue = {hero: film, films: [film, recommendation], cast: [castMember]};
const nodes = node => !node?.props ? [] : [node, ...node.props.children.flatMap(nodes)];

test('accent choices preserve the Cinema surfaces and change only action styles', () => {
  const cyan = createStyles(1, 'cyan');
  const blue = createStyles(1, 'blue');
  for (const key of ['shell', 'sidebar', 'settingsLayout', 'settingsSections', 'settingsPanel', 'homeGuidePanel',
    'homeGuideCell', 'profilePage', 'detailSections', 'detailGradient', 'livePlayerDrawer', 'action', 'playerTrack', 'playerProgress']) {
    assert.deepEqual(cyan[key], blue[key], key);
  }
  assert.equal(cyan.shell.backgroundColor, '#0D141D');
  assert.equal(cyan.settingsPanel.backgroundColor, '#142130');
  assert.equal(cyan.primaryCta.backgroundColor, '#00E5FF');
  assert.notEqual(cyan.primaryCta.backgroundColor, blue.primaryCta.backgroundColor);
  assert.notEqual(cyan.seriesSelected.borderBottomColor, blue.seriesSelected.borderBottomColor);
});

test('details keep decorative glyphs visual and accessible names plain', () => {
  const f = fixture('');
  const details = f.component('Details', {film, active: true, onPlay() {}, onOpen() {}, highContrast: false});
  assert.equal(details.find('Action', 'Play demo').props.displayLabel, '▶  Play demo');
  assert.equal(details.find('Action', 'Add to My List').props.displayLabel, '＋  My List');
});

test('Details keeps captions visual on tvOS and reads film information on deliberate activation', () => {
  for (const platform of ['ios', 'android', 'web']) {
    const f = fixture('', 'applied', platform);
    f.setReader(true);
    const details = f.component('Details', {film: {...film, synopsis: 'The story begins.', languages: 'Arabic'},
      active: true, onPlay() {}, onOpen() {}, highContrast: false});
    const title = nodes(details.tree()).find(n => n.type === 'Text' && n.props.children.includes(film.title));
    assert.equal(title.props.accessible, platform === 'ios' ? false : undefined);
    assert.deepEqual(f.utterances, []);
    details.find('Action', 'Information').props.onPress();
    details.render();
    assert.ok(details.find('Action', 'Information, selected'));
    if (platform === 'ios') {
      assert.equal(f.utterances.length, 1);
      assert.match(f.utterances[0], /Title B.*The story begins.*Languages: Arabic/);
      assert.ok(nodes(details.tree()).filter(n => n.type === 'Text').every(n => n.props.accessible === false));
    } else assert.deepEqual(f.utterances, []);
    details.render();
    assert.equal(f.utterances.length, platform === 'ios' ? 1 : 0);
  }
});

test('a cast card opens the exact selected person occurrence', () => {
  const f = fixture('', 'applied', 'ios');
  f.setReader(true);
  let opened;
  const details = f.component('Details', {film, active: true, onPerson: (person, key) => { opened = {person, key}; }, onPlay() {}, onOpen() {}, highContrast: false});
  details.layout();
  details.find('Action', 'Cast & crew').props.onPress();
  details.render();
  const member = details.find('Rails').props.rails[0].items[0];
  member.onPress();
  assert.deepEqual(opened, {person: castMember, key: occurrenceKey('details', film.id, 'cast', castMember.id)});
  assert.deepEqual(f.utterances, []);
});

test('Details reserves a gutter and a caption for each recommendation and cast card', () => {
  const f = fixture('');
  const details = f.component('Details', {film, active: true, onPlay() {}, onOpen() {}, highContrast: false});
  details.layout();
  function checkCard(caption, alignment) {
    const rails = details.find('Rails').props;
    assert.equal(rails.horizontalAlignment, alignment);
    const rail = rails.rails[0];
    assert.ok(rail.itemStyle.marginEnd > 0);
    assert.equal(rail.itemStyle.width + rail.itemStyle.marginEnd, rail.itemExtent);
    assert.equal(rail.itemStyle.height, rails.rowExtent);
    const card = nodes(rails.renderItem(rail.items[0]));
    assert.equal(card.find(node => node.type === 'Text').props.children[0], caption);
    assert.ok(card.find(node => node.type === 'Picture').props.style.height < rails.rowExtent);
  }
  checkCard(recommendation.title, 'pinned');
  f.focusOn(occurrenceKey('details', 'tab', 'Cast & crew'));
  details.render();
  assert.ok(details.find('Action', 'Cast & crew, selected'));
  checkCard(castMember.name, 'nearest');
});

test('the Home backdrop scrolls with its hero and the following rails retain their headings', () => {
  const f = fixture('');
  const home = f.component('Browse', {id: 'home', active: true, featured: true, mode: 'fixture'});
  home.layout();
  const rails = home.find('Rails').props;
  assert.equal(home.find('Backdrop'), undefined);
  assert.equal(f.component('Hero', rails.listHeader.props).find('Backdrop').props.film.id, film.id);
  assert.equal(rails.renderRailHeader(rails.rails[0]).props.children[0], 'Popular stories');
  assert.ok(rails.headerExtent > 34, 'the 34-unit heading needs room below it');
});

test('tvOS attaches profile instructions and Home row names to the controls that own them', () => {
  for (const platform of ['ios', 'android', 'web']) {
    const f = fixture('', 'applied', platform);
    const profile = f.component('Profiles', {id: 'chooser', profile: 'Explorer', onSelect() {}}, 'Profiles');
    const tree = nodes(profile.tree());
    const title = tree.find(node => node.type === 'Text' && node.props.accessibilityRole === 'header');
    assert.equal(title.props.accessible, platform === 'ios' ? false : undefined);
    const names = tree.filter(node => node.type === 'Action').map(node => node.props.label);
    assert.deepEqual(names, ['Explorer, current profile', 'Stargazer']);
    const selected = tree.find(node => node.type === 'Action' && node.props.label.startsWith('Explorer'));
    assert.match(selected.props.tvDescription, /Choose a profile/);
    const home = f.component('Browse', {id: 'home', active: true, featured: true, mode: 'fixture'});
    home.layout();
    const rails = home.find('Rails').props;
    const row = rails.rails[0];
    const header = rails.renderRailHeader(row).props;
    assert.equal(header.accessible, platform === 'ios' ? false : undefined);
    assert.equal(row.items[0].accessibilityLabel.includes(header.children[0]), platform === 'ios');
  }
});

test('Home remembers row entry and pins the focused card while grids keep the source column', () => {
  for (const featured of [true, false]) {
    const browse = fixture('').component('Browse', {id: 'browse', mode: 'fixture', active: true, featured, grid: !featured});
    browse.layout();
    const rails = browse.find('Rails').props;
    assert.equal(rails.rowEntry, featured ? 'remembered' : 'nearest');
    assert.equal(rails.horizontalAlignment, featured ? 'pinned' : 'nearest');
    assert.equal(rails.viewportHeight, 800);
    if (featured) assert.equal(rails.listHeaderExtent, rails.viewportHeight, 'the hero fills the whole Home viewport');
    if (!featured) {
      const row = rails.rails[0];
      assert.equal(row.itemExtent * 5, rails.viewportExtent, 'five grid cells must fit without horizontal scrolling');
      assert.equal(row.itemStyle.width + 2 * row.itemStyle.marginStart, row.itemExtent, 'the outer half gutters match');
    }
  }
});

test('Home gives previews and playback history stable placements separate from ordinary cards', () => {
  const {component} = fixture('');
  const movie = {...film, source: 'tmdb'};
  const watching = [
    {film: movie, position: 30, duration: 120},
    {film: {...movie, source: 'tmdb-mock'}, position: 20, duration: 100},
  ];
  let opened;
  const props = {id: 'home', active: true, featured: true, mode: 'fixture', continueWatching: watching,
    onOpen: (title, key) => { opened = [title, key]; }};
  const browse = component('Browse', props);
  browse.layout();
  const rails = browse.find('Rails').props;
  const [history, normal] = rails.rails;
  assert.equal(history.id, 'continue-watching');
  assert.equal(rails.renderItem(history.items[0]).props.entry, watching[0]);
  assert.match(history.items[0].accessibilityLabel, /25% watched/);
  assert.notEqual(history.items[0].occurrenceKey, history.items[1].occurrenceKey);
  history.items[0].onPress();
  assert.deepEqual(opened, [movie, history.items[0].occurrenceKey]);
  const preview = rails.rails.find(row => row.id === 'home-previews');
  assert.equal(preview.itemStyle.width, normal.itemStyle.width * 2);
  assert.equal(rails.renderItem(preview.items[0]).type, 'HomePreviewCard');
  assert.notEqual(preview.items[0].occurrenceKey, normal.items[0].occurrenceKey);
  const firstNormalKey = normal.items[0].occurrenceKey;
  props.continueWatching = [];
  browse.render();
  assert.equal(browse.find('Rails').props.rails[0].items[0].occurrenceKey, firstNormalKey);
});

test('the More below cue tracks content after the focused row and stays out of navigation', () => {
  let key = 'hero';
  const {ContentBelowCue} = evaluate('ott/src/components/ContentBelowCue.tsx', name => ({
    react: {useMemo: fn => fn(), createElement: (type, props) => ({type, props})},
    'react-native': {StyleSheet: {create: value => value}, View: 'View'},
    '@bougarnem/itar/react': {useFocusState: () => ({kind: 'managed', occurrenceKey: key})},
    '../theme': {useDesign: () => ({u: 1})}, '../language': {useCinemaLanguage: () => ({t: value => value})},
  })[name]);
  const rails = ['first', 'last', 'pagination'].map(id => ({id, items: [{occurrenceKey: id}]}));
  const cue = (hasNextPage = false, active = true) => ContentBelowCue({rails, heroKey: 'hero', hasNextPage, active});
  assert.equal(cue().props.importantForAccessibility, 'no-hide-descendants');
  key = 'first';
  assert.equal(cue().props.pointerEvents, 'none');
  key = 'last';
  assert.equal(cue(), null);
  assert.ok(cue(true));
  key = 'pagination';
  assert.equal(cue(true), null);
  key = 'sidebar';
  assert.equal(cue(true), null);
  key = 'first';
  assert.equal(cue(true, false), null);
});

test('a focused Home preview waits for dwell, returns to its thumbnail and stops on route changes', t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture('preview');
  let reader = false, foreground, active = false;
  const preview = evaluate('ott/src/components/HomePreviewCard.tsx', name => ({
    react: {...f.hooks, createContext: () => ({Provider: 'PreviewProvider'}), useContext: () => active},
    'react-native': {View: 'View', Text: 'Text', StyleSheet: {create: v => v}, Platform: {OS: 'android'},
      AppState: {currentState: 'active', addEventListener: (_, fn) => { foreground = fn; return {remove() { foreground = null; }}; }}},
    '@bougarnem/itar/react': {useIsFocused: key => key === 'preview', useScreenReaderEnabled: () => reader},
    '../theme': {useDesign: () => ({u: 1})}, '../artwork': {filmArtwork: () => 0},
    './Picture': {Picture: 'Picture'}, './PreviewVideo': {PreviewVideo: 'Video'},
    '../preview-audio': {usePreviewAudio: () => ({enabled: false})},
  })[name], {setTimeout, clearTimeout});
  const gate = f.mount(preview.HomePreviewProvider, {active: true});
  active = gate.tree().props.value;
  const props = {film, width: 600, height: 300, occurrence: 'neighbor'};
  const card = f.mount(preview.HomePreviewCard, props);
  assert.ok(card.find('Picture').props.style.width < props.width);
  props.occurrence = 'preview'; card.render();
  const sessionElement = card.tree().props.children[0];
  assert.equal(sessionElement.props.poster.props.style.width, props.width);
  reader = true; gate.render();
  assert.equal(gate.tree().props.value, false);
  reader = false; gate.render();
  assert.equal(gate.tree().props.value, true);
  const session = f.mount(sessionElement.type, sessionElement.props);
  assert.ok(session.find('Picture'));
  assert.equal(session.find('Video'), undefined);
  const tick = ms => { t.mock.timers.tick(ms); session.render(); };
  tick(699); assert.equal(session.find('Video'), undefined);
  tick(1); assert.ok(session.find('Video'));
  assert.ok(session.find('Picture'), 'artwork covers the player while it buffers');
  session.find('Video').props.onReady(); session.render();
  assert.equal(session.find('Picture'), undefined, 'no artwork occludes the playing video');
  tick(9999); assert.ok(session.find('Video'));
  tick(1); assert.ok(session.find('Picture')); assert.equal(session.find('Video'), undefined);
  tick(15000); assert.equal(session.find('Video'), undefined, 'no replay until another focus visit');
  session.unmount();
  const background = f.mount(sessionElement.type, sessionElement.props);
  t.mock.timers.tick(700); background.render();
  const fromPlayer = background.find('Video').props;
  foreground('background'); background.render();
  assert.equal(background.find('Video'), undefined);
  fromPlayer.onReady(); background.render();
  assert.equal(background.find('Video'), undefined, 'a late media callback cannot restart a hidden preview');
  background.unmount();
  active = false; card.render();
  assert.ok(card.find('Picture'));
});

test('both Home preview players use muted passive playback and release the web stream on exit', () => {
  let finishes = 0, cleanup;
  const calls = [];
  const media = {
    play: () => { calls.push('play'); return Promise.resolve(); }, pause: () => calls.push('pause'),
    removeAttribute: value => calls.push('remove ' + value), load: () => calls.push('load'),
  };
  const props = {onReady() {}, onFinish: () => finishes++};
  const imports = name => ({
    react: {createElement: (type, attributes) => ({type, props: attributes}),
      useRef: () => ({current: media}), useEffect: fn => { cleanup = fn(); }},
    'react-native': {StyleSheet: {}},
    'react-native-video': {__esModule: true, default: 'Video', ViewType: {TEXTURE: 0}},
    '../../assets/cinematic/previews/bunny.mp4': {uri: 'local-demo.mp4'},
  })[name];
  const file = 'ott/src/components/PreviewVideo';
  const native = evaluate(file + '.tsx', name =>
    name.endsWith('.mp4') ? 42 : imports(name)).PreviewVideo(props).props;
  assert.equal(native.muted, true); assert.equal(native.controls, false); assert.equal(native.focusable, false);
  assert.equal(native.viewType, 0, 'the inline player requests a composited Android texture');
  assert.equal(native.source.uri, 42, 'Metro resolves the bundled video asset');
  native.onProgress({currentTime: 9.9}); assert.equal(finishes, 0);
  native.onProgress({currentTime: 10}); assert.equal(finishes, 1);
  const web = evaluate(file + '.web.tsx', imports).PreviewVideo(props).props;
  assert.equal(media.muted, true); assert.equal(web.tabIndex, -1); assert.equal(web.controls, undefined);
  assert.equal(web.src, 'local-demo.mp4');
  web.onTimeUpdate({currentTarget: {currentTime: 10}}); assert.equal(finishes, 2);
  cleanup(); assert.deepEqual(calls, ['play', 'pause', 'remove src', 'load']);
});

test('hiding a catalogue can report a zero-sized layout without discarding its scroll window', () => {
  const props = {id: 'series', active: true, mode: 'fixture', grid: true};
  const browse = fixture('').component('Browse', props);
  browse.layout(1200, 0);
  assert.equal(browse.find('Rails'), undefined);
  browse.layout(1200, 800);
  props.active = false;
  browse.render();
  for (const [width, height] of [[0, 0], [0, 800], [1200, 0]]) {
    browse.layout(width, height);
    const rails = browse.find('Rails')?.props;
    assert.ok(rails, 'the retained FlatList must not be removed between routes');
    assert.equal(rails.active, false);
    assert.equal(rails.viewportHeight, 800);
    assert.equal(rails.viewportExtent, 1200);
  }
  props.active = true;
  browse.render();
  browse.layout(960, 600);
  assert.equal(browse.find('Rails').props.viewportHeight, 600);
  assert.equal(browse.find('Rails').props.viewportExtent, 960);
});

test('Details fits the recommendation rail inside the scrollable details panel', () => {
  const details = fixture('').component('Details', {film, active: true});
  for (const height of [390, 120]) {
    details.layout(1200, height);
    const scroller = details.find('ScrollView');
    const rail = details.find('Rails');
    assert.ok(nodes(scroller).includes(rail));
    assert.equal(rail.props.viewportHeight, Math.min(height, rail.props.rowExtent));
  }
});

test('Home and recommendations restore a remembered card on Android, with first recommendation as initial entry', () => {
  const f = fixture('', 'applied', 'android');
  const scope = (tree, id) => nodes(tree).find(node => node.type === 'FocusScope' && node.props.id === id);
  assert.equal(scope(f.app.tree(), 'page').props.restoreOnEntry, true);
  const details = f.component('Details', {film, active: true});
  details.layout();
  const entry = scope(details.tree(), 'detail-card-entry');
  assert.equal(entry.props.restoreOnEntry, true);
  assert.equal(entry.props.preferredKey, details.find('Rails').props.rails[0].items[0].occurrenceKey);
});

test('narrow Search rows keep named results and enough room for the pagination control', () => {
  const f = fixture('');
  const browse = f.component('Browse', {id: 'search', active: true, mode: 'fixture', searchResults: true, viewportWidth: 200});
  browse.layout();
  const rails = browse.find('Rails').props;
  assert.equal(rails.headerExtent, 0);
  assert.equal(rails.renderRailHeader, undefined);
  assert.equal(rails.rails[0].items[0].accessibilityLabel, 'Title B, Movie');
  assert.equal(rails.rails.at(-1).id, 'pagination');
  assert.ok(rails.rowExtent >= 116 + 56, 'feedback and its button must fit in the same row');
});

test('Search fits five cards beside the keyboard and preserves the fifth occurrence when another page arrives', () => {
  const f = fixture('', 'applied', 'ios');
  const page = id => ({id, title: id, entries: Array.from({length: 5},
    (_, i) => ({...film, id: id + i}))});
  f.catalogueState.rows = [page('first')];
  const search = f.component('Search', {id: 'search', active: true});
  search.layout(1117, 730);
  const browse = f.component('Browse', search.find('Browse').props);
  browse.layout(1117, 645);
  const rails = () => browse.find('Rails').props;
  const first = rails().rails[0];
  assert.equal(first.itemExtent * first.items.length, rails().viewportExtent);
  const fifth = first.items[4].occurrenceKey;
  f.catalogueState.rows = [...f.catalogueState.rows, page('next')];
  browse.render();
  assert.equal(rails().rails[0].items[4].occurrenceKey, fifth);
  assert.equal(rails().horizontalAlignment, 'nearest');
});

for (const platform of ['web', 'ios']) test(`${platform} grids keep the last loaded row navigable while another page is pending`, () => {
  for (const props of [{grid: true}, {searchResults: true}]) {
    const f = fixture('', 'applied', platform);
    const entries = Array.from({length: 5}, (_, i) => ({...film, id: 'card-' + i}));
    Object.assign(f.catalogueState, {rows: [{id: 'first', entries}], ended: false});
    const browse = f.component('Browse', {id: 'test', active: true, ...props});
    browse.layout();
    const rails = () => browse.find('Rails').props.rails;
    const original = rails()[0].items.map(item => item.occurrenceKey);
    assert.deepEqual(Array.from(browse.find('EndObserver').props.keys), Array.from(original));
    if (platform === 'ios') assert.equal(browse.find('Rails').props.onEndReached, undefined);
    f.catalogueState.loading = true;
    browse.render();
    assert.equal(rails().length, 1, 'Down cannot select a footer that will move');
    Object.assign(f.catalogueState, {loading: false, rows: [...f.catalogueState.rows,
      {id: 'next', entries: entries.map(entry => ({...entry, id: entry.id + '-next'}))}]});
    browse.render();
    assert.deepEqual(rails()[0].items.map(item => item.occurrenceKey), original);
    assert.equal(rails().length, 2);
    f.catalogueState.error = 'Retry';
    browse.render();
    assert.equal(rails().at(-1).items[0].displayLabel, 'Retry fetch');
    assert.equal(rails().at(-1).items[0].accessibilityLabel, platform === 'ios' ? 'Retry fetch. Retry' : 'Retry fetch');
    Object.assign(f.catalogueState, {error: '', ended: true, limitReached: true});
    browse.render();
    assert.equal(rails().at(-1).items[0].accessibilityLabel, 'Continue to next titles');
  }
});

test('crossing the final row triggers one fetch even while its pending cards receive focus', () => {
  const f = fixture('');
  let key = 'above', calls = 0;
  const {EndObserver} = evaluate('ott/src/components/EndObserver.tsx', name => ({
    react: f.hooks, '@bougarnem/itar/react': {useFocusState: () => ({kind: 'managed', occurrenceKey: key})},
  })[name]);
  const props = {keys: ['a', 'b', 'c', 'd', 'e'], active: true, blocked: false, onEnd: () => { calls++; }};
  const end = f.mount(EndObserver, props);
  for (key of ['a', 'b', 'c', 'd', 'e', 'd', 'c', 'b', 'a']) end.render();
  assert.equal(calls, 1);
  props.keys = ['f', 'g', 'h', 'i', 'j'];
  end.render();
  key = 'f'; end.render();
  assert.equal(calls, 2);
});

test('web Search recovers only its own focused edit control when the query becomes empty', () => {
  for (const platform of ['web', 'android']) {
    for (const action of ['Clear', 'Delete']) {
      for (const ownsFocus of [true, false]) {
        const id = 'search';
        const key = occurrenceKey(id, action.toLowerCase());
        const f = fixture(ownsFocus ? key : 'unrelated', 'applied', platform);
        const search = f.component('Search', {id, active: true});
        search.find('Action', 'A').props.onPress(); search.render();
        search.find('Action', action).props.onPress(); search.render();
        assert.equal(search.find('Action', action).props.enabled, false);
        assert.deepEqual(f.requests, platform === 'web' && ownsFocus ? [occurrenceKey(id, 'key', 'A')] : []);
      }
    }
  }
  const f = fixture(occurrenceKey('search', 'delete'), 'applied', 'web');
  const search = f.component('Search', {id: 'search', active: true});
  for (const letter of ['A', 'B']) { search.find('Action', letter).props.onPress(); search.render(); }
  search.find('Action', 'Delete').props.onPress(); search.render();
  assert.equal(search.find('Action', 'Delete').props.enabled, true);
  assert.deepEqual(f.requests, [], 'ordinary deletion must keep its current focus');
});

test('initial web retry waits for committed results and respects focus ownership and repeated failure', () => {
  for (const platform of ['web', 'android']) {
    for (const ownsFocus of [true, false]) {
      const id = 'catalogue';
      const f = fixture(ownsFocus ? occurrenceKey(id, 'load-more') : 'elsewhere', 'applied', platform);
      Object.assign(f.catalogueState, {rows: [], error: 'failed', ended: false});
      const browse = f.component('Browse', {id, active: true, grid: true, mode: 'fixture', kind: 'movie'});
      browse.layout();
      const pagination = () => browse.find('Rails').props.rails.at(-1).items[0];
      const retry = () => pagination().onPress();
      const ready = () => browse.find('Rails').props.onReady();
      retry();
      Object.assign(f.catalogueState, {loading: true, error: ''}); browse.render(); ready();
      assert.equal(pagination().enabled, ownsFocus, 'the fetching placeholder only keeps existing focus');
      assert.deepEqual(f.requests, [], 'loading cannot focus a speculative result');
      Object.assign(f.catalogueState, {loading: false, error: 'again'}); browse.render(); ready();
      assert.equal(pagination().enabled, true);
      assert.deepEqual(f.requests, [], 'another failure must preserve usable Retry');
      retry();
      Object.assign(f.catalogueState, {error: '', ended: true, rows: [{id: 'first', entries: [film]}]});
      browse.render(); ready();
      assert.equal(f.loadCalls(), 2);
      assert.deepEqual(f.requests, platform === 'web' && ownsFocus ? [occurrenceKey(id, 'grid-0', film.id)] : []);
    }
  }
});

test('tvOS Home opens for remote input once the requested hero receives focus', async () => {
  const f = fixture('', 'applied', 'ios');
  const home = () => f.app.find('Browse').props;
  const hero = occurrenceKey(home().id, 'hero', film.id);
  const page = () => nodes(f.app.tree()).find(node => node.props.id === 'page');
  home().onHomeLoading();
  f.app.render();
  assert.equal(f.app.find('Sidebar').props.active, false);
  home().onReady(hero);
  assert.deepEqual(f.requests, [], 'the loader must be removed before the hero request');
  f.app.render();
  assert.deepEqual(f.requests, [hero]);
  assert.equal(f.app.find('Sidebar').props.active, false, 'dispatching a request does not mean the hero has focus');
  f.focusOn(occurrenceKey(home().id, 'hero-guide'), '41');
  assert.equal(f.app.find('Sidebar').props.active, false, 'an unrelated observation cannot release the guard');
  f.focusOn(hero, '42');
  assert.equal(f.app.find('Sidebar').props.active, true, 'Left can enter the sidebar before the receipt');
  assert.equal(page().props.entryReady, true, 'Down can enter the catalogue before the receipt');
  f.focusOn(occurrenceKey('nav', 'Home'));
  await Promise.resolve();
  f.app.render();
  assert.equal(f.app.find('Sidebar').props.expanded, true);
  assert.deepEqual(f.requests, [hero], 'a late receipt must not pull focus back');

  const opener = occurrenceKey(home().id, 'popular', film.id);
  home().onOpen(film, opener);
  f.app.render();
  f.close();
  home().onReady(hero);
  f.app.render();
  assert.equal(f.requests.at(-1), opener);
  assert.equal(f.app.find('Sidebar').props.active, false, 'returning to an opener keeps the restore guard');
});

test('VoiceOver gives the sidebar its own space and a native route into content', () => {
  const f = fixture('', 'applied', 'ios');
  f.setReader(true);
  assert.equal(f.app.find('Sidebar').props.reserveWidth, true);
  assert.equal(f.app.find('Sidebar').props.expanded, true);
  assert.equal(f.app.find('TVFocusGuideView').props.autoFocus, true);
  f.focusOn(occurrenceKey('nav', 'Home'));
  const before = f.requests.length;
  f.remote({eventType: 'right', eventKeyAction: 1});
  assert.equal(f.requests.length, before);
  f.app.find('Browse').props.onOpen(film, 'card');
  f.app.render();
  f.ready();
  assert.equal(f.app.find('Sidebar'), undefined);
  f.close();
  const home = f.app.find('Browse').props;
  home.onReady(occurrenceKey(home.id, 'hero', film.id)); f.app.render();
  const pane = nodes(f.app.tree()).find(node => node.props.id === 'page');
  assert.equal(pane.props.preferredKey, 'card');
  assert.equal(f.requests.length, before, 'route readiness leaves navigation with VoiceOver');
  f.setReader(false);
  assert.equal(f.app.find('Sidebar').props.reserveWidth, false);
  assert.equal(f.app.find('TVFocusGuideView').props.autoFocus, false);
});

test('selecting a catalogue with VoiceOver lands once on its entry control after readiness', () => {
  const f = fixture('', 'applied', 'ios');
  f.setReader(true);
  for (const screen of ['Movies', 'Series', 'Home']) {
    f.navigate(screen);
    const routes = f.app.find(screen === 'Home' ? 'Browse' : 'Catalogue').props;
    const key = screen === 'Home' ? occurrenceKey(routes.id, 'hero', film.id) :
      occurrenceKey(routes.id, 'category', 'All');
    routes.onReady(key); f.app.render();
    routes.onReady(key); f.app.render();
    const pane = nodes(f.app.tree()).find(node => node.props.id === 'page');
    assert.equal(pane.props.preferredKey, key);
    assert.equal(pane.props.accessibilityPaneTitle, screen);
  }
});

test('VoiceOver restores each visited pane to the control that opened it', () => {
  const f = fixture('', 'applied', 'ios');
  f.setReader(true);
  const pane = () => nodes(f.app.tree()).find(node => node.props.id === 'details').props;
  const play = occurrenceKey('details', 'play');
  const homeCard = occurrenceKey('home', 'row', film.id);
  const related = occurrenceKey('details', film.id, 'related', recommendation.id);
  f.app.find('Browse').props.onOpen(film, homeCard); f.app.render(); f.ready();
  assert.equal(pane().preferredKey, play);
  f.app.find('Details').props.onOpen(recommendation, related); f.app.render(); f.ready();
  f.app.find('Details').props.onPlay(recommendation); f.app.render();
  assert.equal(pane().active, false);
  assert.equal(nodes(f.app.tree()).find(node => node.type?.name === 'CinemaShell').props.accessibilityElementsHidden, true);
  f.close(); f.ready();
  assert.equal(pane().preferredKey, play);
  assert.equal(pane().accessibilityPaneTitle, recommendation.title);
  f.close(); f.ready();
  assert.equal(pane().preferredKey, related);
  f.close();
  assert.equal(f.app.find('Sidebar').props.active, false);
  f.app.find('Browse').props.onReady('hero'); f.app.render();
  assert.equal(nodes(f.app.tree()).find(node => node.props.id === 'page').props.preferredKey, homeCard);
});

test('tvOS sidebar Right restores Home scope only while the menu owns input', async () => {
  const f = fixture('', 'applied', 'ios');
  const home = f.app.find('Browse').props;
  const hero = occurrenceKey(home.id, 'hero', film.id);
  home.onReady(hero);
  await Promise.resolve();
  f.focusOn(hero);
  f.focusOn(occurrenceKey('nav', 'Movies'));
  const before = f.requests.length;
  f.remote({eventType: 'down'});
  f.remote({eventType: 'right', eventKeyAction: 0});
  f.remote({eventType: 'right', eventKeyAction: 1});
  f.focusOn(hero);
  f.remote({eventType: 'right', eventKeyAction: 1});
  assert.deepEqual(f.requests.slice(before), ['page']);
  assert.equal(f.requestKinds.at(-1), 'scope');
  f.focusOn(occurrenceKey('nav', 'Home'));
  f.setReader(true);
  f.remote({eventType: 'swipeRight'});
  assert.deepEqual(f.requests.slice(before), ['page'], 'VoiceOver owns navigation');
});

test('Details hides the sidebar and Back restores the catalogue route', () => {
  for (const platform of ['ios', 'android', 'web']) {
    const f = fixture('', 'applied', platform);
    f.navigate('Movies');
    f.app.find('Catalogue').props.onOpen(film, 'movie-card'); f.app.render(); f.ready();
    assert.equal(f.app.find('Sidebar'), undefined);
    f.close();
    assert.equal(f.app.find('Sidebar').props.screen, 'Movies');
    f.app.find('Catalogue').props.onReady('all');
    assert.equal(f.requests.at(-1), 'movie-card');
  }
});

for (const platform of ['android', 'ios', 'web']) {
  test(`Home loading keeps the shell out of focus through the first fetch and retry on ${platform}`, async () => {
    const f = fixture('', 'applied', platform);
    const home = {...f.app.find('Browse').props, mode: 'proxy'};
    Object.assign(f.catalogueState, {rows: [], error: '', loading: true, ended: false});
    const browse = f.component('Browse', home);
    const update = () => {
      f.app.render();
      Object.assign(home, f.app.find('Browse').props, {mode: 'proxy'});
      browse.render();
    };
    const loader = () => nodes(f.app.tree()).some(node => node.props.children.includes('Loading Home…'));
    const scope = () => nodes(f.app.tree()).find(node => node.props.id === 'page');
    const ready = () => browse.find('Rails').props.onReady();
    browse.layout(); update();
    assert.equal(loader(), true);
    assert.equal(f.app.find('Sidebar').props.active, false);
    assert.equal(scope().props.entryReady, false);
    assert.equal(nodes(f.app.tree()).some(node => node.props.inert === true), platform === 'web');
    assert.equal(browse.find('Rails'), undefined, 'no pagination target may receive focus while Home is loading');

    Object.assign(f.catalogueState, {loading: false, error: 'offline'});
    browse.render(); ready();
    assert.deepEqual(f.requests, [], 'reveal the controls before asking for focus');
    update();
    assert.equal(loader(), false);
    const pagination = () => browse.find('Rails').props.rails.at(-1).items[0];
    assert.equal(pagination().displayLabel, 'Retry fetch');
    assert.equal(pagination().accessibilityLabel, platform === 'ios' ? 'Retry fetch. offline' : 'Retry fetch');
    assert.equal(browse.find('Rails').props.listHeader, undefined);
    assert.equal(scope().props.entryReady, false, 'hold automatic entry until the command settles');
    assert.equal(f.app.find('Sidebar').props.active, false);
    assert.equal(scope().props.preferredKey, platform === 'android' ? pagination().occurrenceKey : undefined);
    assert.deepEqual(f.requests, [occurrenceKey(home.id, 'load-more')]);
    await Promise.resolve(); update();
    assert.equal(scope().props.entryReady, true);
    pagination().onPress();
    Object.assign(f.catalogueState, {loading: true, error: ''});
    browse.render(); update();
    assert.equal(loader(), true);

    Object.assign(f.catalogueState, {loading: false, ended: true, rows: [{id: 'first', entries: [film]}]});
    browse.render(); ready(); update();
    assert.equal(scope().props.entryReady, false);
    assert.equal(scope().props.preferredKey, platform === 'android' ? occurrenceKey(home.id, 'hero', film.id) : undefined);
    assert.deepEqual(f.requests, [occurrenceKey(home.id, 'load-more'), occurrenceKey(home.id, 'hero', film.id)]);
    await Promise.resolve(); update();
    assert.equal(scope().props.entryReady, true);
    Object.assign(f.catalogueState, {loading: true});
    browse.render(); update();
    assert.equal(loader(), false, 'background pagination keeps the ready screen interactive');
    assert.ok(browse.find('Rails'));
  });
}

test('Home catalogue props remain stable when input focus moves between cards', () => {
  const f = fixture(occurrenceKey('nav', 'Home'));
  const home = () => f.app.find('Browse').props;
  const previous = home();
  for (const key of ['first-card', 'second-card']) {
    f.focusOn(key);
    assert.equal(f.app.find('Sidebar').props.expanded, false);
    for (const prop of Object.keys(previous)) {
      // The JSX double gives every element a fresh array even when it has no children.
      if (prop !== 'children') assert.equal(home()[prop], previous[prop], prop);
    }
  }
  home().onGuide(occurrenceKey(previous.id, 'hero-guide')); f.app.render();
  assert.equal(home().active, false, 'route changes must still reach the mounted catalogue');
});

test('an empty Home catalogue exposes its reload action without a placeholder hero', () => {
  const f = fixture('');
  Object.assign(f.catalogueState, {rows: [], error: '', loading: false, ended: true});
  const home = f.component('Browse', {...f.app.find('Browse').props, mode: 'proxy'});
  home.layout();
  const rails = home.find('Rails').props;
  assert.equal(rails.listHeader, undefined);
  const reload = rails.rails[0].items[0];
  assert.equal(reload.accessibilityLabel, 'Reload catalogue');
  assert.equal(rails.renderDecoration(reload).props.children[0].props.initial, true);
  rails.onReady();
  assert.deepEqual(f.requests, [reload.occurrenceKey]);
});

test('Home publishes its four initial rails together, and a partial fetch failure still permits browsing', () => {
  for (const fail of [false, true]) {
    const f = fixture('');
    const firstPage = Array.from({length: 20}, (_, index) => ({...film, id: 'title-' + index}));
    Object.assign(f.catalogueState, {rows: [{id: 'first', entries: firstPage}], ended: false});
    const home = f.component('Browse', {...f.app.find('Browse').props, mode: 'proxy'});
    home.layout();
    assert.equal(home.find('Rails'), undefined, 'no intermediate dataset during the initial fill');
    if (fail) {
      f.catalogueState.error = 'offline';
    } else {
      f.catalogueState.rows = [{id: 'full', entries: Array.from({length: 60}, (_, index) => ({...film, id: 'title-' + index}))}];
    }
    home.render();
    const rails = home.find('Rails').props;
    assert.equal(rails.rails[0].items.length, fail ? 5 : 15);
    const keys = rails.rails.flatMap(rail => rail.items.map(item => item.occurrenceKey));
    assert.equal(new Set(keys).size, keys.length, 'published Home occurrences remain unique across overlapping recommendations');

    assert.deepEqual(Array.from(rails.rails.find(rail => rail.id === 'tv-guide').items, item => item.occurrenceKey),
      ['Previous', 'Now', 'Next'].map(control => occurrenceKey(f.app.find('Browse').props.id, 'tv-guide', control)),
      'the inline guide publishes its window controls');
    if (fail) {
      assert.equal(rails.rails.at(-1).items[0].accessibilityLabel, 'Retry fetch');
      rails.onReady(); home.render();
      Object.assign(f.catalogueState, {loading: true, error: ''});
      home.render();
      assert.ok(home.find('Rails'), 'retrying partial results keeps the visible catalogue mounted');
    }
  }
});

// Run the real component callbacks and effects without rendering native views.
// The command double records intent; it cannot establish reader-owned focus.
function fixture(inputKey, outcome = 'applied', platform = 'android', readDetails) {
  let current, back, remote, reader = false;
  const requests = [];
  const prompts = [];
  const utterances = [];
  const menuKeys = [];
  const memoized = new Set();
  const requestKinds = [];
  const issue = (kind, key) => {
    requests.push(key); requestKinds.push(kind);
    return {cancel() {}, result: Promise.resolve({status: outcome})};
  };
  const commands = {focusByKey: key => issue('focus', key), restoreFocusByKey: key => issue('restore', key),
    restoreScope: path => issue('scope', path.join('/'))};
  const browserNavigation = {enabled: true};
  const react = {
    useContext: context => context,
    memo: component => { memoized.add(component); return component; },
    createElement: (type, props, ...children) => ({type, props: {...props, children: children.flat(Infinity)}}),
    useState: initial => {
      const owner = current, i = owner.stateIndex++;
      if (!(i in owner.states)) { owner.states[i] = typeof initial === 'function' ? initial() : initial; }
      owner.setters[i] ??= next => {
        const value = typeof next === 'function' ? next(owner.states[i]) : next;
        if (!Object.is(value, owner.states[i])) { owner.states[i] = value; owner.dirty = true; }
      };
      return [owner.states[i], owner.setters[i]];
    },
    useRef: initial => {
      const i = current.refIndex++;
      current.refs[i] ||= {current: initial};
      return current.refs[i];
    },
    useMemo: (callback, deps) => {
      const slot = react.useRef(null);
      if (!slot.current || deps.some((value, i) => !Object.is(value, slot.current.deps[i]))) {
        slot.current = {value: callback(), deps};
      }
      return slot.current.value;
    },
    useCallback: (callback, deps) => {
      const slot = react.useRef(null);
      if (!slot.current || deps.some((value, i) => !Object.is(value, slot.current.deps[i]))) {
        slot.current = {callback, deps};
      }
      return slot.current.callback;
    },
    useLayoutEffect: (callback, deps) => react.useEffect(callback, deps),
    useEffect: (callback, deps) => {
      const owner = current, i = owner.effectIndex++, previous = owner.effects[i];
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
        owner.pending.push(() => { previous?.cleanup?.(); owner.effects[i] = {deps, cleanup: callback()}; });
      }
    },
  };
  let focus = {kind: 'managed', occurrenceKey: inputKey};
  const library = {saved: [], watching: [], ready: true, error: ''};
  const store = {toggle(value) {
    library.saved = library.saved.some(saved => saved.id === value.id) ?
      library.saved.filter(saved => saved.id !== value.id) : [value, ...library.saved];
  }, progress(value, position, duration, ended) {
    library.watching = library.watching.filter(entry => entry.film.id !== value.id);
    if (!ended) library.watching.unshift({film: value, position, duration});
  }, retry() {}};
  const catalogueState = {loading: false, error: '', ended: true, limitReached: false,
    rows: ['first', 'second'].map(id => ({id, title: id, entries: [film]}))};
  let loadCalls = 0, detailData;
  const imports = name => {
    if (name.endsWith('/tv-accessibility')) return evaluate('ott/src/tv-accessibility.ts', imports);
    if (name.endsWith('/language')) return {useCinemaLanguage: () => ({language: 'en-US', rtl: false, t: (value, fields) => fields ? value.replace(/\{(\w+)\}/g, (token, name) => fields[name] ?? token) : value, toggle() {}})};
    if (name === 'react') { return react; }
    if (name === 'react-native') {
      return {TVEventControl: {enableTVMenuKey: () => menuKeys.push(true), disableTVMenuKey: () => menuKeys.push(false)},
        TVEventHandler: {addListener: callback => { remote = callback; return {remove: () => { remote = undefined; }}; }},
        AccessibilityInfo: {announceForAccessibility: message => utterances.push(message)},
        View: 'View', Text: 'Text', Image: 'Image', ScrollView: 'ScrollView', TVFocusGuideView: 'TVFocusGuideView', Alert: {alert: title => prompts.push(title)}, Platform: {OS: platform, isTV: true},
        useWindowDimensions: () => ({width: 1920}), BackHandler: {addEventListener: (_, callback) => {
          back = callback; return {remove() {}};
        }}};
    }
    if (name === '@bougarnem/itar/react') {
      return {Focusable: 'Focusable', FocusProvider: 'FocusProvider', FocusScope: 'FocusScope', FocusVirtualizedRails: 'Rails', occurrenceKey,
        useFocusCommands: () => commands, useFocusReady: () => true, useFocusState: () => focus, useScreenReaderEnabled: () => reader,
        useIsFocused: key => focus.kind === 'managed' && focus.occurrenceKey === key};
    }
    if (name.endsWith('/theme')) { return {DesignTheme: 'Theme', useDesign: () => ({s: cinemaStyles, u: 1, colors: {muted: '#BDC8D3', focus: '#26D9F2', accent: '#98BFFF', panel: '#142131', outline: '#52616E', selection: '#285568', track: '#334B60', raised: '#1D2C3C', focusFill: '#176B7B', actionRing: '#FFFFFF', playerFocus: '#29465F', playerHover: '#B9D5FF'}})}; }
    if (name === './components/GuidePreview') return {
      HomeGuideSelection: 'HomeGuideSelection',
      useHomeGuide: id => ({rails: [{id: 'tv-guide', items: [
        {occurrenceKey: occurrenceKey(id, 'tv-guide', 'Previous')},
        {occurrenceKey: occurrenceKey(id, 'tv-guide', 'Now')},
        {occurrenceKey: occurrenceKey(id, 'tv-guide', 'Next')},
      ]}]}),
    };
    if (name.startsWith('./components/')) {
      const component = name.split('/').at(-1);
      if (component === 'CinemaRails') return {CinemaRails: 'Rails'};
      if (component === 'HomePreviewCard') return {HomePreviewCard: component, HomePreviewProvider: 'HomePreviewProvider', PreviewSession: 'PreviewSession'};
      return {[component]: component, ...(component === 'Metadata' ? {PlaybackBadges: 'PlaybackBadges'} : {})};
    }
    if (name === './Live') return {Live: 'Live'};
    if (name === './live-source') {
      const live = {id: 'fixture-live', title: 'Fixture live', category: 'News', media: {live: true}};
      return {liveChannels: [live], pickLiveChannel: () => live};
    }
    if (name === './family-titles') return {familyMovies: [film], kidsSeries: [film]};
    if (name === './curated') return {collectionsForMode: () => Array.from({length: 9}, (_, index) => ({id: index ? 'collection-' + index : 'road', name: index ? 'Collection ' + index : 'The Road Less Travelled', titles: [index ? recommendation : film]}))};
    if (name === './WeekendMovies') return {WeekendMovies: 'WeekendMovies'};
    if (name === './OpenFilms') return {OpenFilms: 'OpenFilms'};
    if (name === './usePlaybackChoices') return {usePlaybackChoices: () => undefined};
    if (name === '@react-native-async-storage/async-storage') return {getItem: async () => null, setItem: async () => undefined};
    if (name === './cinema-profiles') return evaluate('ott/src/cinema-profiles.ts', imports);
    if (name === './Hero') return {...evaluate('ott/src/Hero.tsx', imports), __esModule: true, default: 'Hero'};
    if (name === './Sports') return {Sports: 'Sports'};
    if (name === './Discovery') return {Collections: 'Collections', Kids: 'Kids'};
    if (name === './PersonDetails') return {PersonDetails: 'PersonDetails'};
    if (name === './Reviews') return {Reviews: 'Reviews'};
    if (name === './Episodes') return {...evaluate('ott/src/Episodes.tsx', imports), Episodes: 'Episodes'};
    if (name === './artwork') { return {icons: {}, portraits: {}, art: [], profileAvatars: [], filmArtwork: value => value.art}; }
    if (name === './useAppleTVMenu' || name === './useSidebarRight') {
      return evaluate(`ott/src/${name.slice(2)}${platform === 'ios' ? '.ios' : ''}.ts`, imports);
    }
    if (name === './navigation' || name === './android-focus-boundary') {
      return evaluate(`ott/src/${name.slice(2)}.ts`, imports);
    }
    if (name === './catalog') { return catalogue; }
    if (name === './catalog-types') { return evaluate('ott/src/catalog-types.ts'); }
    if (name === './browser-navigation') return {BrowserNavigation: browserNavigation, useBrowserPointerDown: () => ({current: false})};
    if (name === './browse-layout') { return evaluate('ott/src/browse-layout.ts'); }
    if (name === './guide') { return {useGuide: () => ({guide: null})}; }
    if (name === './useCatalogue') {
      return {useCatalogue: () => ({state: catalogueState, loadMore: () => { loadCalls++; }, reload() {}, nextWindow() {}})};
    }
    if (name === './detail-data') { return detailData ??= evaluate('ott/src/detail-data.ts', imports); }
    if (name === './tmdb') { return {fetchDetails: readDetails ?? (() => Promise.resolve({
      film: {...film, id: 'enriched-b', title: 'Enriched B'}, cast: [], related: [recommendation],
    }))}; }
    if (name === './useProfileLibrary') return {useProfileLibrary: () => ({library, store})};
    if (name === './profile-library') return {libraryId: value => (value.source ?? 'fixture') + '/' + value.id};
    if (name === './demo-stream') return evaluate('ott/src/demo-stream.ts', imports);
    if (name === './MyList') return {__esModule: true, default: 'MyList'};
    if (name === './browser-session') { return {readBrowserSession: () => ({mode: 'fixture', profile: 'Explorer'}), saveBrowserSession() {}}; }
    if (['./Profiles', './Settings', './Sidebar'].includes(name)) {
      const component = name.slice(2);
      return {[component]: component};
    }
    if (/\.(png|jpg|mp4)$/.test(name)) { return 0; }
    if (/^\.\/(src\/)?(Auth|Epg|Browse|Catalogue|Search|Details|Player|Hero)$/.test(name)) {
      return {__esModule: true, default: name.split('/').at(-1), Metadata: 'Metadata'};
    }
    throw new Error(`Unexpected import ${name}`);
  };
  const load = (name, exported = 'default') => evaluate(`ott/${name}.tsx`, imports, {
    AbortController, setTimeout: callback => { callback(); return 1; }, clearTimeout() {},
  })[exported];
  function mount(component, props) {
    const owner = {states: [], setters: [], refs: [], effects: [], pending: [], renders: 0};
    const render = () => {
      let passes = 0;
      do {
        assert.ok(passes++ < 15, 'component effects must settle');
        current = owner; owner.dirty = false;
        owner.stateIndex = owner.refIndex = owner.effectIndex = 0;
        owner.renders++;
        owner.tree = component(props);
        owner.pending.splice(0).forEach(run => run());
      } while (owner.dirty);
    };
    render();
    return {render, dirty: () => owner.dirty, renders: () => owner.renders, tree: () => owner.tree, unmount: () => owner.effects.forEach(effect => effect?.cleanup?.()),
      find: (type, label) => nodes(owner.tree).find(node => node.type === type && (!label || node.props.label === label)),
      layout: (width = 1200, height = 800) => {
        nodes(owner.tree).filter(node => node.props.onLayout).forEach(node =>
          node.props.onLayout({nativeEvent: {layout: {width, height}}}));
        render();
      }};
  }
  const observer = mount(load('src/Cinema'), {});
  const routeProps = {...observer.tree().props};
  const routeType = observer.tree().type;
  const routes = mount(routeType, routeProps);
  function update(force) {
    do {
      observer.render();
      const next = observer.tree().props;
      // The JSX double always supplies an empty children array, which real JSX omits.
      const changed = Object.keys(next).some(key => key !== 'children' && !Object.is(next[key], routeProps[key]));
      Object.assign(routeProps, next);
      if (force || routes.dirty() || changed || !memoized.has(routeType)) routes.render();
      force = false;
    } while (observer.dirty());
  }
  const app = {...routes, render: () => update(true)};
  const component = (name, props, exported) => mount(load(`src/${name}`, exported), props);
  return {app, component, mount, utterances, hooks: react, remote: event => remote?.(event), requests, requestKinds, prompts, menuKeys, catalogueState, loadCalls: () => loadCalls,
    setReader: enabled => { reader = enabled; app.render(); },
    focusOn: (key, mount) => {
      if (focus.occurrenceKey !== key || focus.mount !== mount) {
        focus = {kind: 'managed', occurrenceKey: key, mount}; update(false);
      }
    },
    navigate: screen => {
      const sidebar = mount(evaluate('ott/src/Sidebar.tsx', imports).Sidebar, app.find('Sidebar').props);
      const button = nodes(sidebar.tree()).find(node =>
        node.type === 'SidebarButton' && node.props.id === occurrenceKey('nav', screen));
      button.props.onPress();
      app.render();
    },
    ready: () => { app.find('Details').props.onReady(); app.render(); },
    close: () => { assert.equal(back(), true); app.render(); },
  };
}

test('Search returns to the activated duplicate occurrence while input focus stays on A', async () => {
  const page = 'Explorer:fixture:Search';
  const f = fixture(occurrenceKey(page, 'key', 'A'), 'unavailable');
  f.navigate('Search');
  const search = f.component('Search', f.app.find('Search').props);
  const browse = f.component('Browse', search.find('Browse').props);
  browse.layout();
  const rails = browse.find('Rails').props;
  rails.onReady(); f.app.render();
  const first = rails.rails[0].items[0], second = rails.rails[1].items[0];
  assert.equal(first.contentId, second.contentId);
  assert.notEqual(first.occurrenceKey, second.occurrenceKey);
  second.onPress(); f.app.render(); f.ready(); f.close();
  f.app.find('Search').props.onReady(occurrenceKey(page, 'key', 'A'));
  assert.equal(f.requests.at(-1), second.occurrenceKey, 'return must use activated B, not input-focused A');
  assert.deepEqual(f.requestKinds, ['focus', 'focus', 'restore'], 'only the Android return has restoration authority');
  await Promise.resolve(); f.app.render();
  assert.ok(nodes(f.app.tree()).some(node => node.props.children.includes('Continue with your remote.')),
    'an unavailable request must retain the existing manual-navigation notice');
});

test('an unavailable entry leaves the catalogue viewport intact and its notice clears on Back', async () => {
  const f = fixture('', 'unavailable');
  f.navigate('Series');
  const category = f.app.find('Catalogue').props;
  category.onOpen(film, occurrenceKey(category.id, 'grid-2', film.id));
  f.app.render();
  f.ready();
  await Promise.resolve();
  f.app.render();
  const notice = () => nodes(f.app.tree()).find(node => node.props.children.includes('Continue with your remote.'));
  const {style, pointerEvents} = notice().props;
  assert.equal(Object.assign({}, ...style).position, 'absolute', 'the notice must not shrink either route');
  assert.equal(pointerEvents, 'none');
  f.close();
  assert.equal(f.app.find('Catalogue').props.active, true);
  assert.equal(notice(), undefined, 'the next route must get its own entry result');
});

test('Back from nested recommendations visits each parent Details and then its exact grid opener', () => {
  const f = fixture(occurrenceKey('nav', 'Movies'));
  f.navigate('Movies');
  const category = f.component('Catalogue', f.app.find('Catalogue').props);
  category.find('Action', 'Drama').props.onPress(); category.render();
  const browse = f.component('Browse', category.find('Browse').props);
  browse.layout();
  const rails = browse.find('Rails').props;
  rails.onReady(); f.app.render();
  const opener = rails.rails[0].items[0];
  assert.equal(opener.occurrenceKey, occurrenceKey('Explorer:fixture:Movies:Drama', 'grid-0', film.id));
  opener.onPress(); f.app.render(); f.ready();
  const visits = [];
  for (let step = 0; step < 2; step++) {
    const props = f.app.find('Details').props;
    let activatedKey;
    const details = f.component('Details', {...props, onOpen: (value, key) => {
      activatedKey = key; props.onOpen(value, key);
    }});
    details.layout();
    const next = details.find('Rails').props.rails[0].items[0];
    next.onPress(); f.app.render();
    assert.equal(activatedKey, next.occurrenceKey);
    visits.push({film: props.film, opener: activatedKey});
    f.ready();
  }
  for (const visit of visits.reverse()) {
    f.close();
    const parent = f.app.find('Details').props;
    assert.equal(parent.film.id, visit.film.id);
    assert.equal(f.app.find('Catalogue').props.active, false);
    const scope = nodes(f.app.tree()).find(node => node.props.id === 'details');
    assert.equal(scope.props.entryReady, false);
    assert.equal(scope.props.preferredKey, visit.opener);
    f.ready();
    assert.equal(f.requests.at(-1), visit.opener);
    assert.equal(f.requestKinds.at(-1), 'restore');
  }
  f.close();
  assert.equal(f.app.find('Details'), undefined);
  assert.equal(f.app.find('Catalogue').props.active, true);
  f.app.find('Catalogue').props.onReady(occurrenceKey('Movies', 'category', 'All'));
  assert.equal(f.requests.at(-1), opener.occurrenceKey);
});

test('player Back waits for the episode rail and restores its opening occurrence', () => {
  const f = fixture(occurrenceKey('nav', 'Series'));
  f.navigate('Series');
  const series = {...film, kind: 'series'};
  f.app.find('Catalogue').props.onOpen(series, 'catalogue-series');
  f.app.render();
  f.ready();
  const episode = occurrenceKey('details', series.id, 'episode', '2', '2');
  f.app.find('Details').props.onPlay(series, {label: 'S2 E2 · Selected episode', opener: episode, seasonNumber: 2});
  f.app.render();
  assert.match(f.app.find('Player').props.title, /S2 E2 · Selected episode/);
  assert.equal(f.app.find('Player').props.onCheckpoint, undefined);
  f.close();
  const props = f.app.find('Details').props;
  assert.equal(props.waitForEpisode, true);
  assert.equal(props.waitForRecommendations, false);
  const count = f.requests.length;
  const details = f.component('Details', props);
  details.layout();
  assert.equal(f.requests.length, count);
  details.find('Episodes').props.onReady();
  assert.equal(f.requests.at(-1), episode);
  assert.equal(f.requestKinds.at(-1), 'restore');
});

test('Back from a cast credit restores the person credit and then the cast card', () => {
  const f = fixture(occurrenceKey('nav', 'Series'));
  f.navigate('Series');
  const series = {...film, kind: 'series'};
  f.app.find('Catalogue').props.onOpen(series, 'catalogue-series');
  f.app.render(); f.ready();
  const actor = occurrenceKey('details', series.id, 'cast', castMember.id);
  f.app.find('Details').props.onPerson(castMember, actor);
  f.app.render();
  const biography = occurrenceKey('person', castMember.id, 'biography');
  f.app.find('PersonDetails').props.onReady(biography);
  assert.equal(f.requests.at(-1), biography);
  const credit = occurrenceKey('person', castMember.id, 'credit', recommendation.id);
  f.app.find('PersonDetails').props.onOpen(recommendation, credit);
  f.app.render(); f.ready();
  f.close();
  assert.equal(f.app.find('PersonDetails').props.member, castMember);
  assert.equal(f.app.find('PersonDetails').props.restoreCredit, true);
  f.app.find('PersonDetails').props.onReady();
  assert.equal(f.requests.at(-1), credit);
  f.close();
  const props = f.app.find('Details').props;
  assert.equal(props.waitForCast, true);
  const details = f.component('Details', props);
  details.layout();
  assert.ok(details.find('Action', 'Cast & crew, selected'));
  details.find('Rails').props.onReady();
  assert.equal(f.requests.at(-1), actor);
});

test('returning Details waits for its recommendation data and the accepted rail before restoring', async () => {
  const props = {film: {...film, source: 'tmdb'}, active: true, waitForRecommendations: true, onReady() {}};
  const details = fixture('').component('Details', props);
  details.layout();
  assert.ok(details.find('RecommendationsPlaceholder'));
  assert.equal(details.find('Rails').props.onReady, undefined, 'the initial empty rail cannot accept a restore');
  await new Promise(resolve => setImmediate(resolve));
  details.render();
  assert.equal(details.find('RecommendationsPlaceholder'), undefined);
  const accepted = details.find('Rails').props;
  assert.equal(accepted.rails[0].items[0].occurrenceKey, occurrenceKey('details', film.id, 'related', recommendation.id));
  assert.equal(accepted.onReady, props.onReady);
});

test('entering a cold nested title preserves fast Right before or after static layout', async () => {
  const parent = {...film, source: 'tmdb'};
  const child = {...recommendation, source: 'tmdb'};
  for (const beforeLayout of [true, false]) {
    let resolveDetails;
    const f = fixture('', 'applied', 'android', () => new Promise(resolve => { resolveDetails = resolve; }));
    f.app.find('Browse').props.onOpen(parent, occurrenceKey('home', parent.id)); f.app.render(); f.ready();
    const opener = occurrenceKey('details', parent.id, 'related', child.id);
    f.focusOn(opener);
    f.app.find('Details').props.onOpen(child, opener); f.app.render();
    const details = f.component('Details', f.app.find('Details').props);
    const listKey = occurrenceKey('details', 'list');
    const count = f.requests.length;
    if (beforeLayout) f.focusOn(listKey);
    details.layout();
    assert.equal(f.requests.length, count + (beforeLayout ? 0 : 1), 'only an unentered route requests Play');
    if (!beforeLayout) f.focusOn(listKey);
    const afterRight = f.requests.length;
    assert.ok(details.find('RecommendationsPlaceholder'));
    assert.equal(details.find('Rails').props.onReady, undefined);
    resolveDetails({film: child, cast: [], related: [parent]});
    await new Promise(resolve => setImmediate(resolve));
    details.render(); f.app.render();
    assert.equal(details.find('RecommendationsPlaceholder'), undefined);
    assert.equal(details.find('Rails').props.onReady, undefined);
    assert.equal(f.requests.length, afterRight, 'accepting recommendations must not issue a focus command');
  }
});

test('nested Details distinguishes previous-title focus from a new mount with the same control key', () => {
  const listKey = occurrenceKey('details', 'list');
  for (const newMount of [false, true]) {
    const f = fixture('');
    f.app.find('Browse').props.onOpen(film, 'opener'); f.app.render(); f.ready();
    f.focusOn(listKey, '10');
    // Semantic activation can leave input focus on the old title's My List.
    f.app.find('Details').props.onOpen(recommendation, 'related-opener'); f.app.render();
    if (newMount) f.focusOn(listKey, '11');
    const count = f.requests.length;
    const details = f.component('Details', f.app.find('Details').props);
    details.layout();
    assert.deepEqual(f.requests.slice(count), newMount ? [] : [occurrenceKey('details', 'play')]);
  }
});

test('Back shows cached parent recommendations on the first render and restores their exact opener', async () => {
  const parent = {...film, source: 'tmdb'};
  const child = {...recommendation, source: 'tmdb'};
  const requested = [];
  const f = fixture('', 'applied', 'android', async value => {
    requested.push(value.id);
    return {film: value, cast: [], related: value.id === parent.id ? [child] : []};
  });
  f.app.find('Browse').props.onOpen(parent, 'opener'); f.app.render();
  let details = f.component('Details', f.app.find('Details').props);
  details.layout();
  await new Promise(resolve => setImmediate(resolve)); details.render(); f.app.render();
  const target = details.find('Rails').props.rails[0].items[0];
  target.onPress(); details.unmount(); f.app.render();
  details = f.component('Details', f.app.find('Details').props);
  details.layout();
  await new Promise(resolve => setImmediate(resolve)); details.render(); f.app.render();
  f.close(); details.unmount();
  details = f.component('Details', f.app.find('Details').props);
  assert.equal(details.find('RecommendationsPlaceholder'), undefined);
  assert.deepEqual(requested, [parent.id, child.id]);
  details.layout();
  const rail = details.find('Rails').props;
  assert.equal(rail.rails[0].items[0].occurrenceKey, target.occurrenceKey);
  rail.onReady();
  assert.equal(f.requests.at(-1), target.occurrenceKey);
  assert.equal(f.requestKinds.at(-1), 'restore');
});

test('the session details cache separates sources and retries aborted, failed and evicted requests', async () => {
  let fail = false;
  const api = evaluate('ott/src/detail-data.ts', () => ({fetchDetails: async value => {
    if (fail) throw Error('offline');
    return {film: value, cast: [], related: []};
  }}));
  const live = {...film, source: 'tmdb'};
  const mock = {...live, source: 'tmdb-mock'};
  const signal = new AbortController().signal;
  const abort = new AbortController(); abort.abort();
  await api.loadDetails(live, abort.signal);
  assert.equal(api.cachedDetails(live), undefined);
  fail = true;
  await assert.rejects(api.loadDetails(live, signal), /offline/);
  assert.equal(api.cachedDetails(live), undefined);
  fail = false;
  await api.loadDetails(live, signal);
  assert.equal(api.cachedDetails(mock), undefined);
  assert.deepEqual(api.cachedDetails(live).related, []);
  for (let index = 0; index < 32; index++) await api.loadDetails({...live, id: 'other-' + index}, signal);
  assert.equal(api.cachedDetails(live), undefined);
});

test('Android holds automatic page entry until its exact return request settles', async () => {
  const f = fixture(occurrenceKey('nav', 'Movies'));
  const pageScope = () => nodes(f.app.tree()).find(node => node.type === 'FocusScope' && node.props.id === 'page');
  f.navigate('Movies');
  assert.equal(pageScope().props.entryReady, true, 'initial native reader entry remains available');
  const props = f.app.find('Catalogue').props;
  const initial = occurrenceKey(props.id, 'category', 'All');
  const opener = occurrenceKey(`${props.id}:All`, 'grid-0', film.id);
  props.onReady(initial); await Promise.resolve(); f.app.render();
  props.onOpen(film, opener); f.app.render();
  assert.equal(nodes(f.app.tree()).find(node => node.type === 'FocusScope' && node.props.id === 'details').props.entryReady, true);
  // The native reader can activate details before its collection is ready.
  f.close();
  assert.equal(pageScope().props.entryReady, false, 'fallback must wait before restoration dispatch');
  assert.equal(pageScope().props.preferredKey, opener, 'only the exact opener may receive native fallback');
  assert.equal(pageScope().props.accessibilityPaneTitle, undefined, 'reader route change must wait for restoration');
  f.app.find('Catalogue').props.onReady(initial); f.app.render();
  assert.equal(f.requests.at(-1), opener);
  assert.equal(f.requestKinds.at(-1), 'restore');
  assert.equal(pageScope().props.entryReady, false, 'dispatch alone must not reopen automatic entry');
  await Promise.resolve(); f.app.render();
  assert.equal(pageScope().props.entryReady, true, 'reopen after the request settles');
  assert.equal(pageScope().props.preferredKey, undefined, 'return preference must not change later navigation');
  assert.equal(pageScope().props.accessibilityPaneTitle, 'Movies', 'publish the completed reader route');
});

test('Hero opens enriched details but returns to its original rendered occurrence', async () => {
  const f = fixture(occurrenceKey('nav', 'Home'), 'applied', 'android', async () => ({
    film: {...film, title: 'Enriched title'}, cast: [], related: [],
  }));
  const props = f.app.find('Browse').props;
  const hero = f.component('Hero', {id: props.id, active: true, film: {...film, source: 'tmdb'}, onOpen: props.onOpen});
  await new Promise(resolve => setImmediate(resolve)); hero.render();
  const explore = hero.find('Action', 'Open title details');
  assert.equal(hero.find('FocusScope').props.layout, 'row', 'the leading virtualized rail publishes row alignment');
  assert.equal(explore.props.id, occurrenceKey(props.id, 'hero', film.id));
  explore.props.onPress(); f.app.render();
  assert.equal(f.app.find('Details').props.film.title, 'Enriched title');
  f.ready(); f.close();
  f.app.find('Browse').props.onReady(occurrenceKey(props.id, 'load-more'));
  assert.equal(f.requests.at(-1), explore.props.id);
});

for (const platform of ['ios', 'web']) {
  test(`${platform} retains generic focus for initial entry and details return`, () => {
    const f = fixture(occurrenceKey('nav', 'Home'), 'applied', platform);
    const props = f.app.find('Browse').props;
    const key = occurrenceKey(props.id, 'hero', film.id);
    props.onReady(key); f.app.render();
    props.onOpen(film, key); f.app.render(); f.ready(); f.close();
    f.app.find('Browse').props.onReady('initial');
    assert.deepEqual(f.requestKinds, ['focus', 'focus', 'focus']);
    assert.equal(f.requests.at(-1), key);
  });
}

for (const opener of ['Hero']) {
  test(`Android TV guide return restores the activated ${opener} occurrence`, () => {
    const f = fixture(occurrenceKey('nav', 'Home'));
    const browse = f.component('Browse', f.app.find('Browse').props);
    browse.layout();
    const rails = browse.find('Rails').props;
    rails.onReady(); f.app.render();
    const action = f.component('Hero', rails.listHeader.props).find('Action', 'TV guide').props;
    action.onPress(); f.app.render();
    f.app.find('Epg').props.onClose(); f.app.render();
    f.app.find('Browse').props.onReady('initial');
    assert.equal(f.requests.at(-1), action.id ?? action.occurrenceKey);
    assert.deepEqual(f.requestKinds, ['focus', 'restore']);
  });
}

test('My List returns to its opener, and removing that title returns to the empty-state action', () => {
  const f = fixture('');
  f.navigate('Movies');
  f.app.find('Catalogue').props.onOpen(film, 'catalogue-opener');
  f.app.render(); f.ready();
  f.component('Details', f.app.find('Details').props).find('Action', 'Add to My List').props.onPress();
  f.close();
  f.navigate('My List');
  const page = () => f.app.find('MyList').props;
  assert.deepEqual(Array.from(page().saved, item => item.id), [film.id]);
  const saved = f.component('MyList', page());
  saved.layout();
  const card = saved.find('Rails').props.rails[0].items[0];
  card.onPress(); f.app.render(); f.ready(); f.close();
  page().onReady(card.occurrenceKey);
  assert.equal(f.requests.at(-1), card.occurrenceKey);
  assert.equal(f.requestKinds.at(-1), 'restore');
  page().onOpen(film, card.occurrenceKey); f.app.render(); f.ready();
  f.component('Details', f.app.find('Details').props).find('Action', 'Remove from My List').props.onPress();
  f.close();
  const nowEmpty = f.component('MyList', page());
  assert.equal(f.requests.at(-1), nowEmpty.find('Action', 'Browse titles').props.id);
  assert.equal(f.requestKinds.at(-1), 'focus');
});

test('ordinary Home and sidebar traversal skips the route tree and Back uses the observed sidebar boundary', () => {
  const f = fixture('first-card');
  const before = f.app.renders();
  for (const key of ['second-card', 'third-card', 'fourth-card']) f.focusOn(key);
  assert.equal(f.app.renders(), before);
  f.focusOn(occurrenceKey('nav', 'Home'));
  assert.equal(f.app.renders(), before + 1);
  assert.equal(f.app.find('Sidebar').props.expanded, true);
  f.focusOn(occurrenceKey('nav', 'Movies'));
  assert.equal(f.app.renders(), before + 1);
  f.close();
  assert.deepEqual(f.prompts, ['Exit Itar?']);
  f.focusOn('fourth-card');
  assert.equal(f.app.find('Sidebar').props.expanded, false);
  f.close();
  assert.equal(f.requestKinds.at(-1), 'scope');
  assert.equal(f.requests.at(-1), 'navigation');
});

test('returning from playback that inserted Continue Watching requests the original Preview picks card', () => {
  const f = fixture('');
  const home = () => f.app.find('Browse').props;
  const key = occurrenceKey(home().id, 'home-previews', film.id);
  home().onOpen(film, key);
  f.app.render();
  f.ready();
  const details = f.app.find('Details').props;
  details.onToggleSaved(film);
  details.onPlay(film);
  f.app.render();
  f.app.find('Player').props.onCheckpoint(15, 600, false);
  f.app.render();
  f.close();
  f.ready();
  f.close();
  assert.equal(home().continueWatching[0].film.id, film.id);
  home().onReady(occurrenceKey(home().id, 'hero', film.id));
  assert.equal(f.requestKinds.at(-1), 'restore');
  assert.equal(f.requests.at(-1), key);
});

test('tvOS grants Menu to Details, player and guide, and releases it at the top-level sidebar and unmount', () => {
  const sidebar = occurrenceKey('nav', 'Home');
  const f = fixture(sidebar, 'applied', 'ios');
  assert.deepEqual(f.menuKeys, []);
  const home = f.app.find('Browse').props;
  home.onOpen(film, 'home-card'); f.app.render();
  f.app.find('Details').props.onOpen(recommendation, 'related-card'); f.app.render();
  f.app.find('Details').props.onPlay(recommendation); f.app.render();
  assert.deepEqual(f.menuKeys, [true], 'nested routes keep one Menu subscription');
  f.close();
  assert.equal(f.app.find('Details').props.film.id, recommendation.id);
  f.close();
  assert.equal(f.app.find('Details').props.film.id, film.id);
  f.close();
  assert.deepEqual(f.menuKeys, [true, false]);
  home.onGuide('guide'); f.app.render();
  assert.deepEqual(f.menuKeys, [true, false, true]);
  f.app.find('Epg').props.onClose(); f.app.render();
  assert.deepEqual(f.menuKeys, [true, false, true, false]);
  f.focusOn('home-card');
  f.focusOn(sidebar);
  assert.deepEqual(f.menuKeys.slice(-2), [true, false], 'content can return to the sidebar');
  f.navigate('Settings');
  assert.equal(f.menuKeys.at(-1), false, 'the sidebar is still at the tvOS root');
  f.focusOn(occurrenceKey('Explorer:fixture:Settings', 'slow'));
  assert.equal(f.menuKeys.at(-1), true, 'Settings content owns the first Back');
  f.app.unmount();
  assert.equal(f.menuKeys.at(-1), false);
});

test('web Home returns through the ordered shell to its remembered card after sidebar entry', () => {
  const f = fixture('last-card', 'applied', 'web');
  const page = nodes(f.app.tree()).find(n => n.type === 'FocusScope' && n.props.id === 'page');
  const details = nodes(f.app.tree()).find(n => n.type === 'FocusScope' && n.props.id === 'details');
  assert.equal(page.props.order, 1);
  assert.equal(details.props.order, 1);
  assert.equal(page.props.restoreOnEntry, true);
  f.close();
  assert.equal(f.requests.at(-1), 'shell/navigation');
});

test('player suggestions omit the current title and continue at the next available season', async () => {
  const f = fixture('');
  const seasons = [3, 0, 1, 2].map(number => ({number, name: 'Season ' + number}));
  const show = {...film, id: 'show', kind: 'series', source: 'tmdb'};
  const movie = {...film, source: 'tmdb'};
  const episode = (season, position) => ({key: season + '/' + position, title: 'Episode ' + position});
  const firstSeason = [episode(1, 1), episode(1, 2)];
  const seasonRequests = [];
  const opened = [];
  const useChoices = evaluate('ott/src/usePlaybackChoices.ts', name => ({
    react: f.hooks,
    './catalog': {films: [movie, recommendation]},
    './demo-stream': {sampleFilm: () => undefined},
    './artwork': {filmArtwork: () => null},
    './detail-data': {
      loadDetails: async () => ({seasons, related: [movie, recommendation]}),
      loadSeason: async (_, number) => {
        seasonRequests.push(number);
        return number === 2 ? [] : [episode(number, 1), episode(number, 2)];
      },
    },
    './Episodes': {episodeVideoChoices: (_, __, values) => values},
  })[name], {AbortController}).usePlaybackChoices;
  const view = props => f.mount(function Queue() {
    return {type: 'Queue', props: {choices: useChoices(props.film, props.episode, (...args) => opened.push(args)), children: []}};
  }, {});
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const args = {film: show, episode: {label: 'Episode 1', opener: '1/1', seasonNumber: 1, queue: firstSeason}};
  const seriesPlayer = view(args);
  const choices = player => player.tree().props.choices;
  assert.equal(choices(seriesPlayer).episodes.length, 1);
  assert.equal(choices(seriesPlayer).nextEpisode.key, '1/2');
  assert.deepEqual(seasonRequests, []);
  args.episode = {...args.episode, label: 'Episode 2', opener: '1/2'};
  seriesPlayer.render();
  await tick(); seriesPlayer.render();
  assert.equal(choices(seriesPlayer).episodes[0].key, '1/1');
  assert.equal(choices(seriesPlayer).startsNextSeason, true);
  assert.deepEqual(seasonRequests, [2, 3]);
  choices(seriesPlayer).nextEpisode.play();
  assert.equal(opened[0][1].opener, '3/1');
  assert.equal(opened[0][1].seasonNumber, 3);
  assert.equal(opened[0][1].queue[1].key, '3/2');
  seriesPlayer.unmount();

  const moviePlayer = view({film: movie});
  await tick(); moviePlayer.render();
  assert.equal(choices(moviePlayer).related.length, 1);
  assert.equal(choices(moviePlayer).related[0].key, recommendation.id);
  moviePlayer.unmount();
});

test('browser preview opts into audio and retries muted when autoplay is blocked', async () => {
  let attempts = [], finishes = 0;
  const media = {
    play() {
      attempts.push(this.muted);
      return this.muted ? Promise.resolve() : Promise.reject({name: 'NotAllowedError'});
    },
  };
  const {PreviewVideo} = evaluate('ott/src/components/PreviewVideo.web.tsx', name => ({
    react: {createElement() {}, useRef: () => ({current: media}), useEffect: effect => effect()},
    '../../assets/cinematic/previews/bunny.mp4': {uri: 'preview.mp4'},
  })[name]);
  PreviewVideo({audioEnabled: true, onReady() {}, onFinish() { finishes++; }});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(attempts, [false, true]);
  assert.equal(finishes, 0);
});
