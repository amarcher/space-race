package tech.spaceexplorer.spacerace;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Orientation: match iOS — phones portrait-locked, tablets rotate freely.
        // Android has no manifest ~ipad split, so branch at runtime on the
        // smallest-width qualifier (>= 600dp = tablet). The play area is portrait.
        boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
        setRequestedOrientation(isTablet
            ? ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        // Opt IN to edge-to-edge on every API level. On Android 15+ the system
        // enforces it anyway (enforcement removes the opt-OUT, it does not opt you
        // in), but Fire OS 8 tablets run API 30 — and there the window would
        // otherwise lay out INSIDE the system bars, so the starfield stops dead at
        // the status/nav bars and the inset plumbing below never does anything.
        // Calling this makes behaviour identical across API levels instead of
        // depending on the OS version, which also means the inset path is exercised
        // on the hardware we can actually test on.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Edge-to-edge safe areas. Now that we always draw behind the bars, the
        // WebView's CSS env(safe-area-inset-*) only reports display
        // CUTOUTS, not the system bars, so we feed the real inset from native
        // WindowInsets into --safe-area-inset-* custom properties, which index.css
        // consumes ahead of env() (see the --safe-* block there). Values are in CSS
        // px (physical px ÷ density). Re-fires on rotation / gesture-nav changes.
        WebView webView = getBridge().getWebView();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            float d = getResources().getDisplayMetrics().density;
            String js = "(function(s){"
                + "s.setProperty('--safe-area-inset-top','" + Math.round(bars.top / d) + "px');"
                + "s.setProperty('--safe-area-inset-right','" + Math.round(bars.right / d) + "px');"
                + "s.setProperty('--safe-area-inset-bottom','" + Math.round(bars.bottom / d) + "px');"
                + "s.setProperty('--safe-area-inset-left','" + Math.round(bars.left / d) + "px');"
                + "})(document.documentElement.style);";
            webView.evaluateJavascript(js, null);
            return insets;
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        // The SPA loads once, shortly after onCreate; force an inset pass now so the
        // variables are (re)applied after the web document is in place.
        View webView = getBridge().getWebView();
        if (webView != null) {
            ViewCompat.requestApplyInsets(webView);
        }
    }
}
