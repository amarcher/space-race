package tech.spaceexplorer.spacerace;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Match the iOS orientation policy: phones are portrait-locked, tablets rotate
    // freely. Android has no manifest ~ipad split, so we branch at runtime on the
    // smallest-width qualifier (>= 600dp = a tablet). The play area is designed
    // portrait, so locking phones keeps the table from reflowing into landscape.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean isTablet = getResources().getConfiguration().smallestScreenWidthDp >= 600;
        setRequestedOrientation(isTablet
            ? ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }
}
