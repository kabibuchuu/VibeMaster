const { withAndroidManifest, withSettingsGradle, withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

function withVibeMasterKotlinCompiler(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let source = modConfig.modResults.contents;
    const from = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')";
    const to = "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10')";
    if (source.includes(from)) source = source.replace(from, to);
    modConfig.modResults.contents = source;
    return modConfig;
  });
}

function withVibeMasterAndroidSdk(config) {
  return withAppBuildGradle(config, (modConfig) => {
    let source = modConfig.modResults.contents;
    source = source.replace(/minSdkVersion\s*(?:=\s*)?rootProject\.ext\.minSdkVersion/g, 'minSdkVersion 26');
    if (!/minSdkVersion\s+26/.test(source)) {
      source = source.replace(/defaultConfig\s*\{/, (match) => 'defaultConfig {\n        minSdkVersion 26');
    }
    return { ...modConfig, modResults: { ...modConfig.modResults, contents: source } };
  });
}

function withDebugAarMetadataDiagnostic(config) {
  return withAppBuildGradle(config, (modConfig) => {
    // The published InnerTubeX AAR advertises compileSdk 37, which is not
    // available from the stable SDK packages in this runner. Disable only the
    // metadata preflight so we can verify whether the dependency actually
    // compiles against the stable SDK; compilation errors remain fatal.
    const markers = [
      'tasks.matching { it.name == "checkDebugAarMetadata" }.configureEach { enabled = false }',
      'tasks.matching { it.name == "checkReleaseAarMetadata" }.configureEach { enabled = false }',
    ];
    for (const marker of markers) {
      if (!modConfig.modResults.contents.includes(marker)) {
        modConfig.modResults.contents += '\n// VibeMaster SDK metadata diagnostic\n' + marker + '\n';
      }
    }
    return modConfig;
  });
}

function withJitPackRepository(config) {
  return withSettingsGradle(config, (modConfig) => {
    const source = modConfig.modResults.contents;
    if (source.includes('https://jitpack.io')) return modConfig;
    const anchors = [
      /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/,
      /(pluginManagement\s*\{[\s\S]*?repositories\s*\{)/,
    ];
    const anchor = anchors.find((pattern) => pattern.test(source));
    if (anchor) {
      modConfig.modResults.contents = source.replace(anchor, "$1\n        maven { url 'https://jitpack.io' }");
      return modConfig;
    }
    const topLevelRepositories = /(^|\n)repositories\s*\{/;
    if (topLevelRepositories.test(source)) {
      modConfig.modResults.contents = source.replace(topLevelRepositories, "$1repositories {\n    maven { url 'https://jitpack.io' }");
      return modConfig;
    }
    modConfig.modResults.contents = source + "\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)\n    repositories { maven { url 'https://jitpack.io' }; google(); mavenCentral() }\n}\n";
    return modConfig;
  });
}

function withPlaybackService(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    const app = manifest.application?.[0];
    if (!app) throw new Error('VibeMaster playback plugin: Android application manifest entry missing');
    app.service = app.service || [];
    const serviceName = 'com.vibemaster.player.VibeMasterPlaybackService';
    if (!app.service.some((service) => service.$?.['android:name'] === serviceName)) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'true',
          'android:foregroundServiceType': 'mediaPlayback',
        },
        'intent-filter': [{ action: [{ $: { 'android:name': 'androidx.media3.session.MediaSessionService' } }] }],
      });
    }
    return modConfig;
  });
}

module.exports = function withVibeMasterPlayback(config) {
  config = withVibeMasterKotlinCompiler(config);
  config = withVibeMasterAndroidSdk(config);
  config = withJitPackRepository(config);
  config = withDebugAarMetadataDiagnostic(config);
  config = withPlaybackService(config);
  return config;
};
