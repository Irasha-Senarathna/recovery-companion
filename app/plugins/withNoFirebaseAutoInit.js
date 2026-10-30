// Privacy: expo-notifications ships Firebase Messaging on Android. If a
// google-services.json is ever added (support circle, M6), Firebase must not
// register a push token or collect analytics for people who never opt in.
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const META = {
  firebase_messaging_auto_init_enabled: 'false',
  firebase_analytics_collection_deactivated: 'true',
};

module.exports = function withNoFirebaseAutoInit(config) {
  return withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    for (const [name, value] of Object.entries(META)) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, value);
    }
    return mod;
  });
};

module.exports.META = META;
