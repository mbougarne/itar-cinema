import type { ImageSourcePropType } from 'react-native';
import type { DemoMedia } from './demo-stream';

export type LiveChannel = Readonly<{
  id: string;
  title: string;
  category: string;
  artwork: ImageSourcePropType;
  media: DemoMedia;
}>;

const artwork = {
  news: require('../assets/cinematic/live-news.jpg'),
  sports: require('../assets/cinematic/live-sports.jpg'),
  kids: require('../assets/cinematic/kids/kids-fox.jpg'),
  movies: require('../assets/cinematic/night.jpg'),
} as const;

const labels = {
  news: 'News',
  sports: 'Sports',
  kids: 'Kids',
  movies: 'Movies',
} as const;

// A curated subset of IPTV-org's M3U entries. Playback requests go directly to each provider.
const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="aljazeera" group-title="news",Al Jazeera English
https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8
#EXTINF:-1 tvg-id="red-bull" group-title="sports",Red Bull TV
https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8
#EXTINF:-1 tvg-id="pbs-kids" group-title="kids",PBS KIDS
https://livestream.pbskids.org/out/v1/14507d931bbe48a69287e4850e53443c/est.m3u8
#EXTINF:-1 tvg-id="classic-cinema" group-title="movies",Classic Cinema
https://rpn.bozztv.com/gusa/gusa-classiccinema/index.m3u8
#EXTINF:-1 tvg-id="france24-ar" group-title="news",France 24 Arabic
https://live.france24.com/hls/live/2037222-b/F24_AR_HI_HLS/master_5000.m3u8
#EXTINF:-1 tvg-id="fifa" group-title="sports",FIFA+
https://95cedebd.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/Vml6aW9fRklGQVBsdXNFbmdsaXNoX0hMUw/playlist.m3u8
#EXTINF:-1 tvg-id="metv-toons" group-title="kids",MeTV Toons
https://sr-live-weigel1.akamaized.net/out/v1/0d1dbf29e64e47bc991796cc24fbeb97/index_2.m3u8
#EXTINF:-1 tvg-id="artflix" group-title="movies",ARTFLIX Movie Classics
https://amogonetworx-artflix-1-nl.samsung.wurl.tv/playlist.m3u8
#EXTINF:-1 tvg-id="france24-es" group-title="news",France 24 Spanish
https://live.france24.com/hls/live/2037220-b/F24_ES_HI_HLS/master_5000.m3u8
#EXTINF:-1 tvg-id="fuel" group-title="sports",FUEL TV
https://amg01074-fueltv-fueltvemeaen-rakuten-b6j62.amagi.tv/hls/amagi_hls_data_rakutenAA-fueltvemeaen/CDN/master.m3u8
#EXTINF:-1 tvg-id="movie-sphere" group-title="movies",MovieSphere
https://amg00353-lionsgatestudio-moviesphere-xumo-zh5u0.amagi.tv/playlist.m3u8
#EXTINF:-1 tvg-id="sky-ar" group-title="news",Sky News Arabia
https://live-stream.skynewsarabia.com/c-horizontal-channel/horizontal-stream/index.m3u8
#EXTINF:-1 tvg-id="tvs-sports" group-title="sports",TVS Classic Sports
https://rpn.bozztv.com/gusa/gusa-tvs/index.m3u8
#EXTINF:-1 tvg-id="aljazeera-ar" group-title="news",Al Jazeera Arabic
https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8
#EXTINF:-1 tvg-id="wpt" group-title="sports",World Poker Tour
https://d2e00kr7m9coe4.cloudfront.net/scheduler/scheduleMaster/406.m3u8`;

function readPlaylist(): LiveChannel[] {
  const lines = playlist.split('\n');
  const channels: LiveChannel[] = [];

  for (let index = 1; index < lines.length; index += 2) {
    const item =
      /^#EXTINF:-1 tvg-id="([a-z0-9-]+)" group-title="(news|sports|kids|movies)",(.+)$/.exec(
        lines[index],
      );

    const url = lines[index + 1];

    if (!item || !/^https:\/\/.+\.m3u8(?:\?.*)?$/.test(url)) continue;

    const [, id, group, title] = item;
    const category = group as keyof typeof labels;

    channels.push({
      id,
      title,
      category: labels[category],
      artwork: artwork[category],
      media: {
        name: title,
        live: true,
        native: { uri: url, type: 'm3u8' },
        web: url,
        credit: title,
      },
    });
  }

  return channels;
}

export const liveChannels = readPlaylist();

export const pickLiveChannel = () =>
  liveChannels[Math.floor(Math.random() * liveChannels.length)];
