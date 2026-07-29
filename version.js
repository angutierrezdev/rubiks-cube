// Single source of truth for the app version.
//
// Loaded by index.html for the page title and the Controls panel, and pulled
// into sw.js with importScripts for the cache name. One number, one place: if
// the page and the service worker can disagree about the version, the worker
// keeps serving a cache it believes is current and users never see the build
// they are looking at.
const APP_VERSION = '1.8.1';

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.APP_VERSION = APP_VERSION;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APP_VERSION };
}
