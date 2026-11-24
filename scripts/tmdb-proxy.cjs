// Standalone local backend. This module must never be imported by React Native.
const http = require('node:http');
const {readFile} = require('node:fs/promises');
const path = require('node:path');
const {metadata} = require('./tmdb-metadata.cjs');
const {mockTmdb} = require('./tmdb-mock.cjs');
const API = 'https://api.themoviedb.org/3';
const IMAGE = 'https://image.tmdb.org/t/p/';
const genres = {Action: {movie: 28, series: 10759}, Comedy: {movie: 35, series: 35}, Drama: {movie: 18, series: 18}, Documentary: {movie: 99, series: 99}, 'Sci-fi': {movie: 878, series: 10765}, Mystery: {movie: 9648, series: 9648}, Animation: {movie: 16, series: 16}, Family: {movie: 10751, series: 10751}, Kids: {movie: '10751,16', series: 10762},
  Adventure: {movie: 12, series: 10759}, Crime: {movie: 80, series: 80},
  Fantasy: {movie: 14, series: 10765}, History: {movie: 36},
  Horror: {movie: 27}, Music: {movie: 10402}, Romance: {movie: 10749},
  Thriller: {movie: 53}, War: {movie: 10752, series: 10768},
  Western: {movie: 37, series: 37}, News: {series: 10763}, Reality: {series: 10764},
  Soap: {series: 10766}, Talk: {series: 10767},
};
const notice = 'This product uses the TMDB API but is not endorsed or certified by TMDB.';
const image = (value, size) => typeof value === 'string' && /^\/[\w.-]+\.(jpg|png|webp)$/.test(value) ? `${IMAGE}${size}${value}` : null;
const text = (value, limit = 4000) => typeof value === 'string' ? value.slice(0, limit) : '';
const validId = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
function mapFilm(item, kind, mock, language = 'en-US') {
  if (!validId(item.id)) { return null; }
  return {id: `tmdb:${kind}:${item.id}`, title: text(kind === 'movie' ? item.title : item.name, 200) || 'Untitled',
    ...metadata(item, kind), kind, category: Array.isArray(item.genres) ? item.genres.map(g => text(g.name, 40)).filter(Boolean).join(' / ') : kind === 'movie' ? 'Movie' : 'Series',
    year: Number(text(kind === 'movie' ? item.release_date : item.first_air_date, 4)) || 0,
    synopsis: text(item.overview) || (language === 'ar-SA' ? 'لا يوجد وصف متاح.' : 'No synopsis available.'), art: 0, source: mock ? 'tmdb-mock' : 'tmdb',
    posterUrl: mock ? `http://127.0.0.1:8789/v1/mock-art/${item.id % 8}` : image(item.poster_path, 'w500'),
    backdropUrl: mock ? `http://127.0.0.1:8789/v1/mock-art/${item.id % 8}` : image(item.backdrop_path, 'w1280')};
}
const nonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
const uniqueBy = (items, key) => [...new Map(items.map(item => [item[key], item])).values()];
function seriesMetadata(result) {
  const seasons = (result.seasons ?? []).filter(season => nonnegativeInteger(season.season_number))
    .map(season => ({number: season.season_number, name: text(season.name, 200) || (season.season_number === 0 ? 'Specials' : `Season ${season.season_number}`)}));
  const networks = (result.networks ?? []).filter(network => validId(network.id) && text(network.name, 120))
    .map(network => ({id: Number(network.id), name: text(network.name, 120), logoUrl: image(network.logo_path, 'w185')}));
  return {seasons: uniqueBy(seasons, 'number').sort((a, b) => a.number - b.number), networks: uniqueBy(networks, 'id')};
}
function createProxy({apiKey = '', mock = true, fetcher = fetch, allowWeb = false} = {}) {
  let active = 0;
  const upstream = async (route, params, signal) => {
    if (mock) { return mockTmdb(route, params); }
    if (!apiKey) { throw new Error('TMDB credentials are not configured on the server.'); }
    const url = new URL(API + route);
    for (const [key, value] of Object.entries(params)) { url.searchParams.set(key, String(value)); }
    url.searchParams.set('api_key', apiKey);
    const result = await fetcher(url, {signal, redirect: 'error', headers: {Accept: 'application/json'}});
    if (!result.ok) { throw new Error(`TMDB request failed (HTTP ${result.status}).`); }
    if (!result.body) { throw new Error('TMDB returned an empty response.'); }
    const reader = result.body.getReader(); const chunks = []; let size = 0;
    while (true) {
      const part = await reader.read(); if (part.done) { break; }
      size += part.value.byteLength;
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('TMDB response exceeded the local limit.'); }
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks, size).toString());
  };
  return http.createServer(async (req, res) => {
    const send = (status, value) => {
      // Whitelist mapping above and last-resort redaction prevent upstream key echoes.
      let body = JSON.stringify(value);
      if (apiKey) { body = body.split(apiKey).join('[redacted]'); }
      res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      res.end(body);
    };
    const origin = req.headers.origin;
    const webOrigin = allowWeb && ['http://127.0.0.1:8081', 'http://localhost:8081'].includes(origin);
    if ((origin && !webOrigin) || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) { send(403, {error: 'Local client origin not allowed'}); return; }
    if (webOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method !== 'GET') { send(405, {error: 'GET only'}); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/health') { send(200, {mode: mock ? 'mock' : 'live', provider: 'TMDB'}); return; }
    if (mock && /^\/v1\/mock-art\/[0-7]$/.test(url.pathname)) {
      const names = ['atlas', 'night', 'tide', 'signal', 'glass', 'letters', 'lights', 'home'];
      const file = path.resolve(__dirname, '../ott/assets/cinematic', `${names[Number(url.pathname.slice(-1))]}.jpg`);
      try { const body = await readFile(file); res.writeHead(200, {'Content-Type': 'image/jpeg', 'Cache-Control': 'max-age=300'}); res.end(body); }
      catch { send(404, {error: 'Mock artwork unavailable'}); }
      return;
    }
    if (!['/v1/catalogue', '/v1/details', '/v1/season', '/v1/reviews', '/v1/person'].includes(url.pathname)) { send(404, {error: 'Unknown proxy endpoint'}); return; }
    const language = url.searchParams.get('language') || 'en-US';
    if (!['en-US', 'ar-SA'].includes(language)) { send(400, {error: 'Invalid catalogue language'}); return; }
    if (active >= 4) { send(429, {error: 'Local proxy busy. Retry shortly.'}); return; }
    active += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    res.on('close', () => { if (!res.writableEnded) { controller.abort(); } });
    try {
      if (url.pathname === '/v1/catalogue') {
        const kind = url.searchParams.get('kind') || 'all';
        const query = (url.searchParams.get('query') || '').trim().toLowerCase();
        if (!['all', 'movie', 'series'].includes(kind) || query.length > 80) { send(400, {error: 'Invalid catalogue query'}); return; }
        const category = url.searchParams.get('category') || 'All';
        if (category !== 'All' && (!Object.hasOwn(genres, category) || !genres[category][kind] || query)) { send(400, {error: 'Invalid catalogue category'}); return; }
        const sort = url.searchParams.get('sort') || 'popular';
        if (!['popular', 'az', 'za', 'newest'].includes(sort) || (sort !== 'popular' && (kind === 'all' || query))) {
          send(400, {error: 'Invalid catalogue sort'}); return;
        }
        let page = 1;
        const cursor = url.searchParams.get('cursor');
        if (cursor) {
          let decoded;
          try { decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString()); }
          catch { send(400, {error: 'Invalid cursor'}); return; }
          if (!decoded || typeof decoded !== 'object') { send(400, {error: 'Invalid cursor'}); return; }
          if (decoded.kind !== kind || decoded.query !== query || (decoded.category || 'All') !== category || (decoded.sort || 'popular') !== sort || (decoded.language || 'en-US') !== language || !Number.isInteger(decoded.page) || decoded.page < 2 || decoded.page > 50) {
            send(400, {error: 'Cursor does not belong to this query'}); return;
          }
          page = decoded.page;
        }
        const type = kind === 'series' ? 'tv' : kind;
        const discover = category !== 'All' || sort !== 'popular';
        const sortField = kind === 'series' ? 'name' : 'title';
        const releaseField = kind === 'series' ? 'first_air_date' : 'primary_release_date';
        const sortBy = {popular: 'popularity.desc', az: sortField + '.asc', za: sortField + '.desc', newest: releaseField + '.desc'}[sort];
        const route = discover ? `/discover/${type}` : query ? `/search/${type === 'all' ? 'multi' : type}` : kind === 'all' ? '/trending/all/week' : `/${type}/popular`;
        const result = await upstream(route, {page, language, include_adult: false, ...(query ? {query} : {}), ...(category !== 'All' ? {with_genres: genres[category][kind]} : {}), ...(discover ? {sort_by: sortBy} : {}), ...(sort === 'newest' ? {[releaseField + '.lte']: new Date().toISOString().slice(0, 10)} : {})}, controller.signal);
        if (!Array.isArray(result.results)) { throw new Error('TMDB returned an invalid catalogue.'); }
        const seen = new Set();
        const films = result.results.slice(0, 20).flatMap(item => {
          const media = kind === 'all' ? item.media_type : type;
          if (!['movie', 'tv'].includes(media) || item.adult === true) { return []; }
          const film = mapFilm(item, media === 'tv' ? 'series' : 'movie', mock, language);
          if (!film || seen.has(film.id)) { return []; }
          seen.add(film.id); return [film];
        });
        const rows = Array.from({length: Math.ceil(films.length / 5)}, (_, i) => ({id: `tmdb-page-${page}-row-${i}`,
          title: ['Popular stories', 'Worth exploring', 'The poster collection', 'More discoveries'][i], format: i < 2 ? 'landscape' : 'poster', entries: films.slice(i * 5, i * 5 + 5)}));
        const nextCursor = page < Math.min(Number(result.total_pages) || 1, 50)
          ? Buffer.from(JSON.stringify({kind, query, category, sort, page: page + 1, language})).toString('base64url') : null;
        send(200, {rows, nextCursor, source: mock ? 'tmdb-mock' : 'tmdb', attribution: notice});
      } else if (url.pathname === '/v1/details') {
        const match = /^tmdb:(movie|series):(\d+)$/.exec(url.searchParams.get('id') || '');
        if (!match || !validId(match[2])) { send(400, {error: 'Invalid title identity'}); return; }
        const result = await upstream(`/${match[1] === 'movie' ? 'movie' : 'tv'}/${match[2]}`, {include_image_language: language === 'ar-SA' ? 'ar,null' : 'en,null', append_to_response: `images,credits,recommendations,similar,${match[1] === 'movie' ? 'release_dates' : 'content_ratings'}`, language}, controller.signal);
        const film = mapFilm(result, match[1], mock, language);
        if (!film) { throw new Error('TMDB returned invalid details.'); }
        const logos = Array.isArray(result.images?.logos) ? result.images.logos : [];
        for (const artworkLanguage of [language === 'ar-SA' ? 'ar' : 'en', null]) {
          const logo = logos.find(value => value?.iso_639_1 === artworkLanguage && image(value.file_path, 'w500'));
          if (logo) { film.titleLogoUrl = image(logo.file_path, 'w500'); break; }
        }
        const castIds = new Set();
        const rawCast = Array.isArray(result.credits?.cast) ? result.credits.cast.slice(0, 6) : [];
        const rawCrew = (Array.isArray(result.credits?.crew) ? result.credits.crew : []).filter(p => ['Director', 'Writer', 'Creator', 'Executive Producer'].includes(p.job)).slice(0, 2);
        const cast = [...rawCast, ...rawCrew].flatMap(p => {
          if (!validId(p.id) || castIds.has(String(p.id))) { return []; }
          castIds.add(String(p.id));
          return [{id: String(p.id), name: text(p.name, 120), role: text(p.character || p.job, 120) || 'Cast', portraitUrl: mock ? null : image(p.profile_path, 'w185')}];
        });
        const seen = new Set([film.id]);
        const recommended = Array.isArray(result.recommendations?.results) ? result.recommendations.results : [];
        const related = (recommended.length ? recommended : Array.isArray(result.similar?.results) ? result.similar.results : []).slice(0, 12).flatMap(item => {
          if (item.adult === true) { return []; }
          const mapped = mapFilm(item, match[1], mock, language);
          if (!mapped || seen.has(mapped.id)) { return []; }
          seen.add(mapped.id); return [mapped];
        });
        const series = match[1] === 'series' ? seriesMetadata(result) : {};
        send(200, {film, cast, related, ...series, source: mock ? 'tmdb-mock' : 'tmdb', attribution: notice});
      } else if (url.pathname === '/v1/reviews') {
        const id = url.searchParams.get('id') || '';
        const match = /^tmdb:(movie|series):(\d+)$/.exec(id);
        if (!match || !validId(match[2])) { send(400, {error: 'Invalid title identity'}); return; }
        const type = match[1] === 'movie' ? 'movie' : 'tv';
        const reviews = [];
        const seen = new Set();
        for (let page = 1; page <= 5 && reviews.length < 10; page++) {
          const result = await upstream(`/${type}/${match[2]}/reviews`, {language, page}, controller.signal);
          if (!Array.isArray(result.results)) throw new Error('TMDB returned invalid reviews.');
          for (const value of result.results) {
            const reviewId = text(value?.id, 80);
            const content = text(value?.content, 16000).trim();
            if (!reviewId || !content || seen.has(reviewId)) continue;
            seen.add(reviewId);
            const rating = value.author_details?.rating;
            const date = text(value.created_at, 10);
            reviews.push({id: reviewId, content, author: text(value.author, 120) || text(value.author_details?.username, 120) || 'TMDB member',
              date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
              rating: typeof rating === 'number' && rating >= 0 && rating <= 10 ? rating : null});
            if (reviews.length === 10) break;
          }
          if (page >= (Number(result.total_pages) || 1)) break;
        }
        send(200, {id, reviews, source: mock ? 'tmdb-mock' : 'tmdb', attribution: notice});
      } else if (url.pathname === '/v1/season') {
        const id = url.searchParams.get('id') || '';
        const match = /^tmdb:series:(\d+)$/.exec(id);
        const season = url.searchParams.get('season') || '';
        if (!match || !validId(match[1]) || !/^\d+$/.test(season) || !nonnegativeInteger(Number(season))) {
          send(400, {error: 'Invalid series or season identity'}); return;
        }
        const result = await upstream(`/tv/${Number(match[1])}/season/${Number(season)}`, {language}, controller.signal);
        if (result.season_number !== Number(season) || !Array.isArray(result.episodes)) {
          throw new Error('TMDB returned an invalid season.');
        }
        const episodes = result.episodes.filter(episode => nonnegativeInteger(episode.episode_number)).map(episode => ({
          number: episode.episode_number,
          name: text(episode.name, 200) || `Episode ${episode.episode_number}`,
          synopsis: text(episode.overview),
          stillUrl: image(episode.still_path, 'w500'),
          runtime: nonnegativeInteger(episode.runtime) && episode.runtime > 0 ? episode.runtime : null,
          airDate: /^\d{4}-\d{2}-\d{2}$/.test(episode.air_date) ? episode.air_date : null,
        }));
        send(200, {id, season: Number(season), episodes: uniqueBy(episodes, 'number').sort((a, b) => a.number - b.number), source: mock ? 'tmdb-mock' : 'tmdb'});
      } else {
        const id = url.searchParams.get('id');
        if (!validId(id)) { send(400, {error: 'Invalid person identity'}); return; }
        const result = await upstream(`/person/${id}`, {language, append_to_response: 'combined_credits'}, controller.signal);
        const {cast = [], crew = []} = result.combined_credits ?? {};
        const credits = uniqueBy([...cast, ...crew]
          .filter(value => value && value.adult !== true && ['tv', 'movie'].includes(value.media_type))
          .sort((a, b) => (Number(b.vote_count) || 0) - (Number(a.vote_count) || 0))
          .map(value => mapFilm(value, value.media_type === 'tv' ? 'series' : 'movie', mock, language)).filter(Boolean), 'id');
        send(200, {id: String(id), name: text(result.name, 120), bio: text(result.biography, 8000) || 'No biography available.',
          portraitUrl: image(result.profile_path, 'w500'), credits: credits.slice(0, 16),
          department: text(result.known_for_department, 80), birthplace: text(result.place_of_birth, 160),
          birthday: text(result.birthday, 10), deathday: text(result.deathday, 10),
          aliases: Array.isArray(result.also_known_as) ? result.also_known_as.map(value => text(value, 100)).filter(Boolean).slice(0, 5) : [],
          creditCount: credits.length, source: mock ? 'tmdb-mock' : 'tmdb'});
      }
    } catch (error) {
      // Never expose fetch URLs, upstream bodies, raw exception messages or credentials.
      const safe = /^(TMDB request failed \(HTTP \d{3}\)\.|TMDB credentials are not configured on the server\.)$/.test(error.message) ? error.message : 'TMDB proxy request failed. Retry shortly.';
      send(502, {error: safe});
    } finally { clearTimeout(timeout); active -= 1; }
  });
}
async function start() {
  const live = process.argv.includes('--live');
  let apiKey = '';
  if (live) {
    if (!process.argv.includes('--allow-tmdb-key-use')) { throw new Error('Live mode requires explicit --allow-tmdb-key-use after owner approval.'); }
    apiKey = process.env.MOVIE_DATABASE_API_KEY?.trim() ?? '';
    if (!apiKey || apiKey.startsWith('YOUR_') || apiKey.length > 512) { throw new Error('A valid server-side TMDB v3 key is required.'); }
  }
  const server = createProxy({mock: !live, apiKey, allowWeb: process.argv.includes('--allow-web')});
  server.listen(8789, '127.0.0.1', () => console.info(`Itar TMDB proxy: ${live ? 'live' : 'mock responses (no credentials)'} on 127.0.0.1:8789`));
  server.on('error', () => { console.error('Local proxy could not bind 127.0.0.1:8789.'); process.exitCode = 1; });
}
if (require.main === module) { start().catch(() => { console.error('Local TMDB proxy could not start; check server-only setup. No credentials were logged.'); process.exitCode = 1; }); }
module.exports = {createProxy, mapFilm};
