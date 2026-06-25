// UI-visible version shown on the login screen. Bump the patch number on
// EVERY OTA update (eas update) so any device visibly shows which bundle
// it's running — Tyler uses this to track rollout progress.
//
// IMPORTANT: this is intentionally separate from expo.version in app.json.
// runtimeVersion.policy is "appVersion", so bumping app.json's version
// starts a NEW update train that existing installs (built on 1.0.0) would
// never receive — it would silently orphan every deployed tablet. Only bump
// app.json when shipping a new binary through TestFlight / Play Store.
export const UI_VERSION = "1.0.9";
