module.exports = function withNdk26(config) {
  config.android = config.android || {};
  config.android.ndkVersion = "27.2.12479018";
  return config;
};
