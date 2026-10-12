const { withAndroidManifest, withSettingsGradle } = require('@expo/config-plugins');

function withJitPackRepository(config) {
  return withSettingsGradle(config, (modConfig) => {
    const source = modConfig.modResults.contents;
    if (source.includes('https://jitpack.io')) return modConfig;

    const anchor = /(dependencyResolutionManagement\\s*\\{\\s*repositories\\s*\\{)/;
    if (!anchor.test(source)) {
      throw new Error('VibeMaster player: could not find dependencyResolutionManagement.repositories in settings.gradle');
    }
    modConfig.modResults.contents = source.replace(
      anchor,
      "$1\\n        maven { url 'https://jitpack.io' }",
    );
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
  config = withPlaybackService(config);
  return config;
};
