const { withAndroidManifest } = require("expo/config-plugins");
const withViro = require("@reactvision/react-viro/app.plugin").default;

/**
 * ViroReact's config plugin, keeping what other plugins declared. Its
 * manifest mod replaces <queries> with ARCore's package alone, which drops
 * the speech recogniser (dictated comments) and browser intents on
 * Android 11+. Expo runs manifest mods from the last registered to the
 * first, so the snapshot is registered after Viro and the merge before it.
 */
module.exports = function withViroAr(config, props) {
  let before = [];

  config = withAndroidManifest(config, (c) => {
    const queries = c.modResults.manifest.queries ?? [];
    const seen = new Set(queries.map((q) => JSON.stringify(q)));
    for (const q of before) {
      if (!seen.has(JSON.stringify(q))) queries.push(q);
    }
    c.modResults.manifest.queries = queries;
    return c;
  });
  config = withViro(config, props);
  config = withAndroidManifest(config, (c) => {
    before = [...(c.modResults.manifest.queries ?? [])];
    return c;
  });
  return config;
};
