package in.yatribus.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.webkit.WebView;

/** Main Android entry point for the YatraBus Capacitor application. */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CellInfoPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            finish();
            return;
        }

        // React Router consumes Back on child pages. The home screen consumes
        // the first press and returns false on the second press to exit.
        webView.evaluateJavascript(
            "(function(){try{return window.yatribusHandleBack ? window.yatribusHandleBack() : false;}catch(e){return false;}})()",
            handled -> {
                if (!"true".equals(handled)) {
                    finish();
                }
            }
        );
    }
}
