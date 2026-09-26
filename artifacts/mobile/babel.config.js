module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // drizzle/migrations.js imports each migration's .sql file as a string.
    plugins: [["inline-import", { extensions: [".sql"] }]],
  };
};
