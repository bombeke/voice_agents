import { withProjectBuildGradle } from "@expo/config-plugins";

export function withFixCompileSdk(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const snippet = `

// ==========================
// 🔧 Auto Android Build Fixes
// ==========================
gradle.projectsEvaluated {

  def rootCompileSdk = null
  if (project.hasProperty("android") && project.android?.compileSdk) {
    rootCompileSdk = project.android.compileSdk
  }
  if (rootCompileSdk == null) {
    rootCompileSdk = 36
  }

  subprojects { subproject ->

    subproject.plugins.withId("com.android.library") {
      def androidExt = subproject.extensions.findByName("android")
      if (androidExt != null && androidExt.compileSdk == null) {
        androidExt.compileSdk = rootCompileSdk
      }
    }

    subproject.plugins.withId("com.android.application") {
      def androidExt = subproject.extensions.findByName("android")
      if (androidExt != null && androidExt.compileSdk == null) {
        androidExt.compileSdk = rootCompileSdk
      }
    }

    subproject.configurations.configureEach { cfg ->
      cfg.exclude group: "org.pytorch", module: "executorch-android"
    }

    subproject.configurations.configureEach { cfg ->
      cfg.withDependencies { deps ->
        deps.removeAll { dep ->
          try {
            return dep.name?.contains("classes.jar")
          } catch (ignored) {
            return false
          }
        }
      }
    }

  }
}
`;

    if (!contents.includes("Auto Android Build Fixes")) {
      contents += snippet;
    }

    config.modResults.contents = contents;
    return config;
  });
}
