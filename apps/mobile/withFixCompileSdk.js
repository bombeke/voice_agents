const { withProjectBuildGradle } = require("@expo/config-plugins");

module.exports = function withFixCompileSdk(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const snippet = `
subprojects { subproject ->
  afterEvaluate {
    if (subproject.plugins.hasPlugin("com.android.library") ||
        subproject.plugins.hasPlugin("com.android.application")) {

      def androidExt = subproject.extensions.findByName("android")
      if (androidExt != null) {
        if (androidExt.compileSdkVersion == null) {
          androidExt.compileSdkVersion 36
        }
      }
    }
  }
}
`;

    if (!contents.includes("subprojects { subproject ->")) {
      contents += "\n" + snippet;
    }

    config.modResults.contents = contents;
    return config;
  });
};
