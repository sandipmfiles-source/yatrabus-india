package in.yatribus.app.tracking;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundTracking")
public class BackgroundTrackingPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        String sessionId = call.getString("sessionId");
        String busId = call.getString("busId");
        String routeId = call.getString("routeId");
        String apiBase = call.getString("apiBase");
        if (sessionId == null || busId == null || routeId == null || apiBase == null || apiBase.trim().isEmpty()) {
            call.reject("Tracking session and deployed API URL are required.");
            return;
        }
        boolean fine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) {
            call.reject("Location permission is required before starting background tracking.");
            return;
        }
        Intent intent = new Intent(getContext(), YatriBusTrackingService.class);
        intent.putExtra("sessionId", sessionId);
        intent.putExtra("busId", busId);
        intent.putExtra("routeId", routeId);
        intent.putExtra("apiBase", apiBase);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(getContext(), intent);
            } else {
                getContext().startService(intent);
            }
            JSObject result = new JSObject();
            result.put("started", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to start background location service: " + error.getMessage(), error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), YatriBusTrackingService.class));
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }
}
