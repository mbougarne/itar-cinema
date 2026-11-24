// Only public descriptive metadata. Ratings never imply playback entitlements.
const text = (value, max = 500) => typeof value === 'string' ? value.slice(0, max) : '';
const names = (items, field) => Array.isArray(items) ? items.slice(0, 8).map(item => text(item?.[field], 60)).filter(Boolean).join(' · ').slice(0, 500) : '';
function metadata(item, kind) {
  const result = {tagline: text(item.tagline), status: text(item.status), languages: names(item.spoken_languages, 'english_name'),
    countries: names(item.production_countries, 'name'), studios: names(item.production_companies, 'name')};
  for (const [key, value] of Object.entries({rating: item.vote_average, votes: item.vote_count,
    runtime: kind === 'movie' ? item.runtime : item.episode_run_time?.[0], seasons: item.number_of_seasons, episodes: item.number_of_episodes})) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= (key === 'rating' ? 10 : 1000000000)) { result[key] = value; }
  }
  const ratings = kind === 'movie' ? item.release_dates?.results : item.content_ratings?.results;
  // Explicit territory: never present a US certification as a universal age rule.
  if (Array.isArray(ratings)) {
    const local = ratings.find(value => value.iso_3166_1 === 'US');
    const rating = kind === 'movie' ? local?.release_dates?.find(value => value.certification)?.certification : local?.rating;
    if (rating) { result.certification = text(rating, 24); result.certificationRegion = 'US'; }
  }
  return result;
}
module.exports = {metadata};
