module.exports = function withNdk26(config) {
  config.android = config.android || {};
  config.android.ndkVersion = "26.3.11579264";
  return config;
};
