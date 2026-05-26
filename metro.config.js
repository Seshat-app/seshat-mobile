// Explicit Metro config — extends Expo's default so the project passes
// `expo-doctor`'s "metro config" check during EAS Build. No customization
// needed; the default is what we want.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
