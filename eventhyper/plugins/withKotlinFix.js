const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlinFix(config) {
  return withProjectBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Pin Kotlin version
    contents = contents.replace(
      /kotlinVersion\s*=\s*["'][^"']+["']/,
      'kotlinVersion = "2.0.21"'
    );

    // Add KSP classpath if not already present
    if (!contents.includes('symbol-processing-gradle-plugin')) {
      contents = contents.replace(
        'classpath("com.facebook.react:react-native-gradle-plugin")',
        `classpath("com.facebook.react:react-native-gradle-plugin")
    classpath("com.google.devtools.ksp:symbol-processing-gradle-plugin:2.0.21-1.0.28")`
      );
    }

    // Add resolutionStrategy if not already present
    if (!contents.includes('resolutionStrategy')) {
      contents = contents.replace(
        'apply plugin: "expo-root-project"',
        `allprojects {
  configurations.all {
    resolutionStrategy {
      force "org.jetbrains.kotlin:kotlin-stdlib:2.0.21"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk7:2.0.21"
      force "org.jetbrains.kotlin:kotlin-stdlib-jdk8:2.0.21"
      force "org.jetbrains.kotlin:kotlin-reflect:2.0.21"
      force "org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.21"
    }
  }
}

apply plugin: "expo-root-project"`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};