const { withProjectBuildGradle } = require("@expo/config-plugins");

module.exports = function withFixCompileSdk(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const snippet = `
subprojects { subproject ->

  subproject.plugins.withId("com.android.library") {
    def androidExt = subproject.extensions.findByName("android")
    if (androidExt != null && androidExt.compileSdk == null) {
      androidExt.compileSdk = 36
    }
  }

  subproject.plugins.withId("com.android.application") {
    def androidExt = subproject.extensions.findByName("android")
    if (androidExt != null && androidExt.compileSdk == null) {
      androidExt.compileSdk = 36
    }
  }

}
`;

    if (
      !contents.includes('subproject.plugins.withId("com.android.library")')
    ) {
      contents += "\n" + snippet;
    }

    config.modResults.contents = contents;
    return config;
  });
};
