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

// Which store this Android sync targets. The two Android ships are the SAME
// artifact except for the UA marker below, which index.html reads for platform
// attribution. NEITHER Android ship loads GA4: both are declared child-directed
// — Amazon because Fire tablets reach kids through Amazon Kids profiles and
// Amazon's COPPA policy allows only "child-suitable" SDKs, Play because the
// listing declares a target audience including under-13s and is therefore under
// Google Play's Families policy. So the store flag no longer decides analytics;
// it decides the marker (and amazon-submit.sh guards on it).
//   SPACE_RACE_STORE=amazon npx cap sync android   (or: npm run amazon)
// Unset => the Play build. Set at SYNC time — it's baked into the generated
// android/app/src/main/assets/capacitor.config.json, so switching stores means
// re-running the sync, never just a rebuild.
const STORE = process.env.SPACE_RACE_STORE === 'amazon' ? 'amazon' : 'play';

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
    // NB: the config key is `appendUserAgent` (Capacitor reads android.appendUserAgent
    // per CapConfig.java) — NOT `appendUserAgentString`, which Capacitor silently ignores.
    // Both markers suppress GA4 in index.html — see STORE above. The marker's
    // remaining jobs are telling the two ships apart (amazon-submit.sh refuses a
    // Play binary) and keeping web/iOS attribution honest.
    appendUserAgent: STORE === 'amazon' ? 'SpaceRaceAmazon' : 'SpaceRaceAndroid',
  },
  plugins: {
    // Hold the NATIVE splash (iOS: the LaunchScreen storyboard's Ace-Pilot
    // still; Android: the splash resource) until the WEB boot splash — which
    // shows the SAME still — has painted, then BootSplash.tsx calls hide().
    // Without this, iOS drops the launch image the moment the app's first
    // frame renders, exposing ~1s of dark half-loaded webview (the "black
    // gap" between the still flash and the takeover clip).
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#07071a',
      showSpinner: false,
      // Android: the plugin's ImageView is what actually shows the ace-pilot
      // still (@drawable/splash, a single nodpi bitmap). CENTER_CROP is the
      // ImageView spelling of `object-fit: cover` — the exact rule BootSplash.css
      // applies to the SAME source file — so the native still and the web still
      // are the identical crop on any screen, and the handoff between them is
      // invisible. Do NOT put the still in the launch theme's window background
      // instead: that path scales to fill without preserving aspect and cannot
      // be matched. See #141 and res/values/styles.xml.
      androidScaleType: 'CENTER_CROP',
    },
  },
};

export default config;
