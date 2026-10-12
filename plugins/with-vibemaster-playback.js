const { withAndroidManifest, withSettingsGradle, withAppBuildGradle } = require('@expo/config-plugins');

function withDebugAarMetadataDiagnostic(config) {
  return withAppBuildGradle(config, (modConfig) => {
    // Diagnostic only: this CI runner does not currently expose Android API 37,
    // while InnerTubeX's published AAR declares minCompileSdk 37. Skip the
    // metadata preflight on debug so the Kotlin/API references can be tested.
    // Release builds keep the normal metadata check; do not ship until a real
    // API-37-capable toolchain builds the dependency without this diagnostic.
    const marker = 'tasks.matching { it.name == "checkDebugAarMetadata" }.configureEach { enabled = false }';
    if (!modConfig.modResults.contents.includes(marker)) {
      modConfig.modResults.contents += '\n// VibeMaster debug-only SDK metadata diagnostic\n' + marker + '\n';
    }
    return modConfig;
  });
}

function withJitPackRepository(config) {
  return withSettingsGradle(config, (modConfig) => {
    const source = modConfig.modResults.contents;
    if (source.includes('https://jitpack.io')) return modConfig;

    // Expo's settings.gradle layout changes across SDK releases. Prefer the
    // dependency repository block, but fall back to pluginManagement or a
    // top-level repositories block rather than failing prebuild outright.
    const anchors = [
      /(dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{)/,
      /(pluginManagement\s*\{[\s\S]*?repositories\s*\{)/,
    ];
    const anchor = anchors.find((pattern) => pattern.test(source));
    if (anchor) {
      modConfig.modResults.contents = source.replace(
        anchor,
        "$1\n        maven { url 'https://jitpack.io' }",
      );
      return modConfig;
    }
    const topLevelRepositories = /(^|\n)repositories\s*\{/;
    if (topLevelRepositories.test(source)) {
      modConfig.modResults.contents = source.replace(
        topLevelRepositories,
        "$1repositories {\n    maven { url 'https://jitpack.io' }",
      );
      return modConfig;
    }

    // If Gradle's settings do not declare any repository block, append a
    // dependency-resolution block. Existing Expo autolinking configuration
    // remains untouched.
    modConfig.modResults.contents = source +
      "\ndependencyResolutionManagement {\n" +
      "    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)\n" +
      "    repositories { maven { url 'https://jitpack.io' }; google(); mavenCentral() }\n" +
      "}\n";
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
    const alreadyAdded = app.service.some(
      (service) => service.$?.['android:name'] === serviceName,
    );
    if (!alreadyAdded) {
      app.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'true',
          'android:foregroundServiceType': 'mediaPlayback',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'androidx.media3.session.MediaSessionService' } }],
          },
        ],
      });
    }
    return modConfig;
  });
}

module.exports = function withVibeMasterPlayback(config) {
  config = withJitPackRepository(config);
  config = withDebugAarMetadataDiagnostic(config);
  config = withPlaybackService(config);
  return config;
};
