package in.yatribus.app;

import com.getcapacitor.BridgeActivity;
import android.webkit.WebView;

/** Main Android entry point for the YatraBus Capacitor application. */
public class MainActivity extends BridgeActivity {
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        // Keep YatraBus running in the background instead of closing the app
        // when the user presses Back from the home screen.
        moveTaskToBack(true);
    }
}
