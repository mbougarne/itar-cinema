// Local deterministic TMDB-shaped responses, explicitly labelled mock by the proxy.
function mockTmdb(route, params) {
  const reviews = /^\/(movie|tv)\/(\d+)\/reviews$/.exec(route);
  if (reviews) {
    return {results: Number(reviews[2]) % 2 ? [] : [{id: 'mock-review', author: 'Mock reviewer', content: 'A synthetic review from the local TMDB proxy.', created_at: '2026-01-01', author_details: {rating: 7}}]};
  }
  const season = /^\/tv\/\d+\/season\/(\d+)$/.exec(route);
  if (season) {
    const number = Number(season[1]);
    return {season_number: number, episodes: number === 0 ? [] : [1, 2].map(episode => ({
      episode_number: episode, name: `Mock episode ${episode}`, overview: 'A deterministic episode for the local proxy.',
      runtime: 42, air_date: '2025-02-02', still_path: null,
    }))};
  }
  const person = /^\/person\/(\d+)$/.exec(route);
  const detail = /^\/(movie|tv)\/(\d+)$/.exec(route);
  const item = (id, type) => ({id, media_type: type, title: `Proxy Test Movie ${id}`, name: `Proxy Test Series ${id}`,
    overview: 'Dynamic mock metadata delivered over the local HTTP proxy. This is not live TMDB content.', release_date: '2026-01-01', first_air_date: '2025-02-02', poster_path: null, backdrop_path: null});
  if (person) return {id: Number(person[1]), name: 'Mock Cast Member', biography: 'A mock biography used to test the local proxy without any TMDB credential.',
    combined_credits: {cast: [item(900008, 'tv'), item(900009, 'movie')]}};
  if (detail) { return {...item(Number(detail[2]), detail[1]), genres: [{name: 'Mock adventure'}], ...(detail[1] === 'tv' ? {seasons: [0, 1, 2].map(season_number => ({season_number})), networks: [{id: 1, name: 'Mock network'}]} : {}), recommendations: {results: Array.from({length: 6}, (_, i) => item(Number(detail[2]) + i + 1, detail[1]))}, credits: {cast: [{id: 9001, name: 'Mock Cast Member', character: 'Test character', profile_path: null}]}}; }
  const page = Number(params.page) || 1;
  const type = route.includes('/tv') ? 'tv' : 'movie';
  const results = Array.from({length: 20}, (_, i) => item(900000 + (page - 1) * 20 + i, route.includes('/all/') || route.includes('/multi') ? (i % 2 ? 'tv' : 'movie') : type));
  return {page, total_pages: 4, results: params.query ? results.filter(value => `${value.title} ${value.name}`.toLowerCase().includes(String(params.query).toLowerCase())) : results};
}
module.exports = {mockTmdb};
