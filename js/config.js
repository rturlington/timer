// Tolliver's Timer configuration.
//
// Leave CAST_APP_ID empty to cast with Chrome's built-in Presentation API
// (works out of the box from desktop Chrome — no registration needed).
//
// Optional: if you register a Custom Web Receiver at
// https://cast.google.com/publish pointing at your hosted tv.html,
// paste its Application ID here to use the native Google Cast SDK instead
// (lets the Chromecast run the timer on its own, even if your laptop sleeps).
window.TOLLIVER_CONFIG = {
  CAST_APP_ID: '',
  CAST_NAMESPACE: 'urn:x-cast:com.tolliver.timer',
};
