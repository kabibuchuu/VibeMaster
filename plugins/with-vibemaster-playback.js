const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withVibeMasterPlayback(config) {
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
};
