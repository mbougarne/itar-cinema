const {test} = require('node:test');
const http = require('node:http');
const assert = require('node:assert/strict');
const {createProxy} = require('./tmdb-proxy.cjs');
const {mockTmdb} = require('./tmdb-mock.cjs');
async function run(options, check) {
  const server = createProxy(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await check(base); } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('browser access is opt-in and restricted to the two local probe origins', async () => {
  await run({}, async base => {
    const response = await fetch(`${base}/health`, {headers: {Origin: 'http://127.0.0.1:8081'}});
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });
  await run({allowWeb: true}, async base => {
    for (const origin of ['http://127.0.0.1:8081', 'http://localhost:8081']) {
      const response = await fetch(`${base}/v1/catalogue`, {headers: {Origin: origin}});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('vary'), 'Origin');
      assert.equal((await response.json()).source, 'tmdb-mock');
      assert.equal((await fetch(`${base}/health`, {method: 'POST', headers: {Origin: origin}})).status, 405);
    }
    for (const origin of ['https://example.com', 'null', 'http://127.0.0.1:8080', 'http://localhost.evil:8081']) {
      const response = await fetch(`${base}/health`, {headers: {Origin: origin}});
      assert.equal(response.status, 403);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    }
    const foreignHost = await new Promise((resolve, reject) => {
      http.get(`${base}/health`, {headers: {Host: 'example.com', Origin: 'http://127.0.0.1:8081'}}, res => {
        res.resume(); resolve(res.statusCode);
      }).on('error', reject);
    });
    assert.equal(foreignHost, 403);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  });
});
test('mock server returns paged metadata/cast without credentials or external fetches', async () => {
  await run({mock: true, fetcher: () => { throw new Error('External fetch forbidden'); }}, async base => {
    const first = await (await fetch(`${base}/v1/catalogue?kind=all`)).json();
    assert.equal(first.source, 'tmdb-mock'); assert.equal(first.rows.length, 4);
    const id = first.rows[0].entries[0].id;
    const next = await (await fetch(`${base}/v1/catalogue?kind=all&cursor=${first.nextCursor}`)).json();
    assert.notEqual(next.rows[0].id, first.rows[0].id);
    const details = await (await fetch(`${base}/v1/details?id=${id}`)).json();
    assert.equal(details.film.id, id); assert.equal(details.cast[0].name, 'Mock Cast Member');
    assert.equal(details.related.length, 6);assert.ok(details.related.every(item => item.id !== id && item.source === 'tmdb-mock'));
    const person = await (await fetch(`${base}/v1/person?id=9001`)).json();
    assert.match(person.bio, /mock biography/);
  });
});
test('catalogue filters and sorts at the provider before paging', async () => {
  await run({mock: false, apiKey: 'test-only-catalogue-key', fetcher: async url => {
    assert.equal(url.pathname, '/3/discover/tv');
    assert.equal(url.searchParams.get('sort_by'), 'name.asc');
    assert.equal(url.searchParams.get('with_genres'), '10751');
    return new Response(JSON.stringify({
      results: [{id: 1, name: 'A family title', first_air_date: '2026-01-01'}], total_pages: 2,
    }));
  }}, async base => {
    const result = await (await fetch(`${base}/v1/catalogue?kind=series&category=Family&sort=az`)).json();
    assert.equal(result.rows[0].entries[0].title, 'A family title');
    assert.ok(result.nextCursor);
    const wrong = await fetch(`${base}/v1/catalogue?kind=series&category=Family&sort=za&cursor=${result.nextCursor}`);
    assert.equal(wrong.status, 400);
  });
});

test('live adapter sends only to fixed HTTPS TMDB origin and never returns the mock secret', async () => {
  const fake = 'mock-server-credential-not-a-real-key'; let calls = 0;
  await run({mock: false, apiKey: fake, fetcher: async (url, options) => {
    calls += 1; assert.equal(url.origin, 'https://api.themoviedb.org');
    assert.equal(url.searchParams.get('api_key'), fake); assert.equal(options.redirect, 'error');
    const value = mockTmdb(url.pathname.replace('/3', ''), {page: 1});
    value.results[0].title = fake; value.api_key = fake;
    return new Response(JSON.stringify(value));
  }}, async base => {
    const response = await fetch(`${base}/v1/catalogue?kind=movie`); const raw = await response.text();
    assert.equal(response.status, 200); assert.ok(!raw.includes(fake)); assert.ok(!raw.includes('api_key'));
    assert.match(raw, /redacted/); assert.equal(calls, 1);
  });
});
test('rejects arbitrary endpoints, injected IDs, foreign and malformed cursors, and writes', async () => {
  await run({mock: true}, async base => {
    const page = await (await fetch(`${base}/v1/catalogue?kind=movie`)).json();
    for (const [route, status] of [['/v1/fetch?url=http://example.invalid', 404], ['/v1/details?id=../../etc/passwd', 400],
      ['/v1/catalogue?kind=invalid', 400], ['/v1/catalogue?cursor=invalid', 400], [`/v1/catalogue?kind=series&cursor=${page.nextCursor}`, 400]]) {
      assert.equal((await fetch(base + route)).status, status, route);
    }
    assert.equal((await fetch(`${base}/v1/catalogue`, {method: 'POST'})).status, 405);
    assert.equal((await fetch(`${base}/health`, {headers: {Origin: 'https://example.invalid'}})).status, 403);
    const foreignHost = await new Promise((resolve, reject) => {
      http.get(`${base}/health`, {headers: {Host: 'example.invalid'}}, response => { response.resume(); resolve(response.statusCode); }).on('error', reject);
    });
    assert.equal(foreignHost, 403);
  });
});
test('upstream errors are sanitized instead of exposing URLs or credential-bearing exception text', async () => {
  const fake = 'dummy-secret-only-for-this-test';
  await run({mock: false, apiKey: fake, fetcher: async () => { throw new Error(`https://example.invalid/?api_key=${fake}`); }}, async base => {
    const response = await fetch(`${base}/v1/catalogue?kind=movie`);const raw = await response.text();
    assert.equal(response.status, 502); assert.ok(!raw.includes(fake)); assert.ok(!raw.includes('example.invalid'));
  });
});
test('bounded concurrency rejects a fifth in-flight upstream request', async () => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  let ready; const started = new Promise(resolve => { ready = resolve; }); let count = 0;
  await run({mock: false, apiKey: 'dummy-test-key', fetcher: async () => {
    count += 1;if (count === 4) { ready(); } await gate;
    return new Response(JSON.stringify(mockTmdb('/movie/popular', {page: 1})));
  }}, async base => {
    const first = Array.from({length: 4}, () => fetch(`${base}/v1/catalogue?kind=movie`));
    await started;assert.equal((await fetch(`${base}/v1/catalogue?kind=movie`)).status, 429);
    release();for (const response of await Promise.all(first)) { assert.equal(response.status, 200); await response.arrayBuffer(); }
  });
});

test('details maps rating, runtime, language and territory-specific certification via appended resources', async () => {
  await run({mock: false, apiKey: 'fake-test-key', fetcher: async url => {
    const movie = url.pathname.includes('/movie/');
    assert.ok(url.searchParams.get('append_to_response').split(',').includes('images'));
    assert.equal(url.searchParams.get('include_image_language'), 'en,null');
    assert.ok(url.searchParams.get('append_to_response').includes(movie ? 'release_dates' : 'content_ratings'));
    return new Response(JSON.stringify({id: 11, title: 'Film', name: 'Series', vote_average: 8.1, vote_count: 42, runtime: 110, episode_run_time: [45],
      images: {logos: [{iso_639_1: null, file_path: '/neutral.png'}, {iso_639_1: 'en', file_path: '/english.png'}]},
      spoken_languages: [{english_name: 'English'}], release_dates: {results: [{iso_3166_1: 'US', release_dates: [{certification: 'PG'}]}]},
      content_ratings: {results: [{iso_3166_1: 'US', rating: 'TV-PG'}]}}));
  }}, async base => {
    for (const kind of ['movie', 'series']) {
      const {film} = await (await fetch(`${base}/v1/details?id=tmdb:${kind}:11`)).json();
      assert.equal(film.titleLogoUrl, 'https://image.tmdb.org/t/p/w500/english.png');
      assert.equal(film.rating, 8.1);assert.equal(film.certificationRegion, 'US');assert.equal(film.languages, 'English');
      assert.equal(film.runtime, kind === 'movie' ? 110 : 45);assert.equal(film.certification, kind === 'movie' ? 'PG' : 'TV-PG');
    }
  });
});

test('genre filters use the matching discover endpoint and bind continuation to the category', async () => {
  const calls = [];
  await run({mock: false, apiKey: 'dummy-category-test', fetcher: async url => {
    calls.push({route: url.pathname, genre: url.searchParams.get('with_genres'), sort: url.searchParams.get('sort_by')});
    return new Response(JSON.stringify(mockTmdb(url.pathname.replace('/3', ''), {page: url.searchParams.get('page')})));
  }}, async base => {
    for (const kind of ['movie', 'series']) {
      const route = `${base}/v1/catalogue?kind=${kind}&category=Action`;
      const first = await (await fetch(route)).json();
      assert.equal(first.rows.length, 4);
      assert.equal((await fetch(`${route}&cursor=${first.nextCursor}`)).status, 200);
      assert.equal((await fetch(`${base}/v1/catalogue?kind=${kind}&category=Comedy&cursor=${first.nextCursor}`)).status, 400);
    }
    for (const suffix of ['kind=all&category=Drama', 'kind=movie&category=unknown', 'kind=movie&category=Drama&query=test']) {
      assert.equal((await fetch(`${base}/v1/catalogue?${suffix}`)).status, 400);
    }
    assert.deepEqual(calls.map(c => c.genre), ['28', '28', '10759', '10759']);
    assert.deepEqual(calls.map(c => c.route), ['/3/discover/movie', '/3/discover/movie', '/3/discover/tv', '/3/discover/tv']);
    assert.ok(calls.every(c => c.sort === 'popularity.desc'));
  });
});

test('series details preserve specials and multiple networks; selected season maps episode fields', async () => {
  const calls = [];
  await run({mock: false, apiKey: 'dummy-season-key', fetcher: async url => {
    calls.push(url.pathname);
    const result = url.pathname.endsWith('/season/0') ? {
      season_number: 0, episodes: [
        {episode_number: 3, name: 'Unavailable artwork'},
        {episode_number: 1, name: 'First special', overview: 'A special.', still_path: '/still.jpg', runtime: 42, air_date: '2025-01-02'},
      ],
    } : {
      id: 42009, name: 'Test series', seasons: [{season_number: 2}, {season_number: 0}],
      networks: [{id: 1, name: 'First network', logo_path: '/network.png'}, {id: 2, name: 'Second network'}],
    };
    return new Response(JSON.stringify(result));
  }}, async base => {
    const id = 'tmdb:series:42009';
    const details = await (await fetch(`${base}/v1/details?id=${id}`)).json();
    assert.deepEqual(details.seasons, [{number: 0, name: 'Specials'}, {number: 2, name: 'Season 2'}]);
    assert.deepEqual(details.networks.map(network => network.logoUrl), ['https://image.tmdb.org/t/p/w185/network.png', null]);
    assert.deepEqual(calls, ['/3/tv/42009']);
    const season = await (await fetch(`${base}/v1/season?id=${id}&season=0`)).json();
    assert.deepEqual(season.episodes, [
      {number: 1, name: 'First special', synopsis: 'A special.', stillUrl: 'https://image.tmdb.org/t/p/w500/still.jpg', runtime: 42, airDate: '2025-01-02'},
      {number: 3, name: 'Unavailable artwork', synopsis: '', stillUrl: null, runtime: null, airDate: null},
    ]);
    assert.equal((await fetch(`${base}/v1/season?id=${id}&season=-1`)).status, 400);
    assert.equal((await fetch(`${base}/v1/season?id=tmdb:movie:42009&season=0`)).status, 400);
    assert.deepEqual(calls, ['/3/tv/42009', '/3/tv/42009/season/0']);
  });
});

test('reviews use the matching provider route and cap mapped unique reviews at ten', async () => {
  const calls = [];
  await run({mock: false, apiKey: 'dummy-review-key', fetcher: async url => {
    calls.push(url.pathname);
    const rated = {id: 'rated', author: 'Reviewer', content: 'A review.', author_details: {rating: 8}, created_at: '2026-01-01T12:00:00Z'};
    const results = url.pathname.includes('/tv/') ? [rated] :
      [rated, ...Array.from({length: 12}, (_, i) => ({id: `review-${i}`, content: `Test review ${i}.`}))];
    return new Response(JSON.stringify({results}));
  }}, async base => {
    const movie = await (await fetch(`${base}/v1/reviews?id=tmdb:movie:1368337`)).json();
    assert.equal(movie.reviews.length, 10);
    assert.deepEqual(movie.reviews[1], {id: 'review-0', author: 'TMDB member', content: 'Test review 0.', rating: null, date: null});
    const tv = await (await fetch(`${base}/v1/reviews?id=tmdb:series:42009`)).json();
    assert.deepEqual(tv.reviews, [{id: 'rated', author: 'Reviewer', content: 'A review.', rating: 8, date: '2026-01-01'}]);
    assert.deepEqual(calls, ['/3/movie/1368337/reviews', '/3/tv/42009/reviews']);
  });
});

test('reviews fill a short first page with unique entries from the next page', async () => {
  const pages = [];
  const review = (id) => ({id, author: 'Reviewer', content: `Review ${id}.`});
  await run({mock: false, apiKey: 'dummy-review-key', fetcher: async url => {
    const page = Number(url.searchParams.get('page'));
    pages.push(page);
    const results = page === 1
      ? [review('first'), {id: 'empty', content: ' '}]
      : [review('first'), ...Array.from({length: 12}, (_, index) => review(`next-${index}`))];
    return new Response(JSON.stringify({total_pages: 4, results}));
  }}, async base => {
    const response = await fetch(`${base}/v1/reviews?id=tmdb:movie:1368337`);
    const {reviews} = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(pages, [1, 2]);
    assert.equal(reviews.length, 10);
    assert.equal(reviews[0].id, 'first');
    assert.equal(reviews[9].id, 'next-8');
  });
});

test('person lookup maps a portrait and mixed, deduplicated film and TV credits', async () => {
  await run({mock: false, apiKey: 'dummy-person-key', fetcher: async url => {
    assert.equal(url.pathname, '/3/person/21');
    assert.equal(url.searchParams.get('append_to_response'), 'combined_credits');
    const tv = {id: 101, media_type: 'tv', name: 'Test series', vote_count: 45};
    return new Response(JSON.stringify({id: 21, name: 'Performer', biography: 'Biography.', profile_path: '/portrait.png',
      known_for_department: 'Acting', birthday: '1974-11-11', place_of_birth: 'Los Angeles, California, USA', also_known_as: ['Alternate name'],
      combined_credits: {cast: [tv, {id: 101, media_type: 'movie', title: 'Test movie', vote_count: 42}],
        crew: [tv, {id: 102, media_type: 'movie', title: 'Excluded title', adult: true}]}}));
  }}, async base => {
    const person = await (await fetch(`${base}/v1/person?id=21`)).json();
    assert.equal(person.portraitUrl, 'https://image.tmdb.org/t/p/w500/portrait.png');
    assert.equal(person.bio, 'Biography.');
    assert.equal(person.department, 'Acting');
    assert.equal(person.birthday, '1974-11-11');
    assert.equal(person.birthplace, 'Los Angeles, California, USA');
    assert.deepEqual(person.aliases, ['Alternate name']);
    assert.equal(person.creditCount, 2);
    assert.deepEqual(person.credits.map(value => value.id), ['tmdb:series:101', 'tmdb:movie:101']);
  });
});

test('Arabic metadata uses the requested TMDB locale and its own catalogue cursor', async () => {
  const seen = [];
  await run({mock: false, apiKey: 'mock-localization', fetcher: async url => {
    seen.push(url.searchParams.get('language'));
    const film = {id: 27205, title: 'استهلال', overview: 'مغامرة في عالم الأحلام.'};
    return new Response(JSON.stringify(url.pathname.endsWith('/27205')
      ? {...film, images: {logos: [{iso_639_1: 'ar', file_path: '/arabic.png'}]}}
      : {results: [film], total_pages: 2}));
  }}, async base => {
    const page = await (await fetch(`${base}/v1/catalogue?kind=movie&language=ar-SA`)).json();
    assert.equal(page.rows[0].entries[0].title, 'استهلال');
    assert.ok(page.nextCursor);
    assert.equal((await fetch(`${base}/v1/catalogue?kind=movie&cursor=${page.nextCursor}`)).status, 400);
    assert.equal((await fetch(`${base}/v1/catalogue?language=unsupported`)).status, 400);
    const details = await (await fetch(`${base}/v1/details?id=tmdb:movie:27205&language=ar-SA`)).json();
    assert.equal(details.film.synopsis, 'مغامرة في عالم الأحلام.');
    assert.match(details.film.titleLogoUrl, /arabic\.png$/);
    assert.deepEqual(seen, ['ar-SA', 'ar-SA']);
  });
});
