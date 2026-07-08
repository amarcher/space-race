import type { CapacitorConfig } from '@capacitor/cli';

// Space Race — native iOS wrapper around the Vite build in `dist/`.
// One codebase, two ships: the web app stays primary; this bundles the same
// build output offline. See docs/ios-roadmap.md.
//
// Media autoplay note: Capacitor's iOS bridge configures WKWebView with
// `allowsInlineMediaPlayback = true` and `mediaTypesRequiringUserActionForPlayback = []`
// by DEFAULT, so card-play clips and the win hero autoplay inline with no user
// gesture. There are no capacitor.config keys for these — they are the native
// defaults — so nothing to set here. (The AudioContext still unlocks on first
// gesture via sfx.ts, same as Safari.)
//
// WKWebView scroll bounce/overscroll likewise has no capacitor.config key; it's
// handled with CSS `overscroll-behavior` / native scrollView tuning in Phase 2.
const config: CapacitorConfig = {
  appId: 'tech.spaceexplorer.spacerace',
  appName: 'Space Race',
  webDir: 'dist',
  // Matches the starfield boot so there's no white flash before the web layer paints.
  backgroundColor: '#07071a',
  ios: {
    backgroundColor: '#07071a',
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#07071a',
    // Serve the bundled app over https://localhost (Capacitor Android default;
    // androidScheme 'https' keeps WebView storage/secure-context semantics).
    allowMixedContent: false,
    // Android has no distinct URL scheme (iOS uses capacitor://localhost), so the
    // GA4 platform split in index.html can't sniff location.protocol. Append a UA
    // marker instead — it's set at WebView creation, so navigator.userAgent already
    // carries it when the <head> analytics snippet runs. See docs/android-roadmap.md.
    appendUserAgentString: 'SpaceRaceAndroid',
  },
};

export default config;
