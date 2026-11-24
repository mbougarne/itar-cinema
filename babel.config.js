module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      require('./scripts/tmdb-endpoint.cjs').inlineProxyURL,
      { url: process.env.ITAR_TMDB_PROXY_URL },
    ],
  ],
};
