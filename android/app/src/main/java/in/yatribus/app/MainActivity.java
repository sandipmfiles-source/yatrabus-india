package in.yatribus.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import in.yatribus.app.tracking.BackgroundTrackingPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundTrackingPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
