package in.yatribus.app.tracking;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class YatriBusTrackingService extends Service implements LocationListener {
    private static final String CHANNEL_ID = "yatribus_live_tracking";
    private static final int NOTIFICATION_ID = 7214;
    private LocationManager locationManager;
    private String sessionId;
    private String busId;
    private String routeId;
    private String apiBase;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        sessionId = intent.getStringExtra("sessionId");
        busId = intent.getStringExtra("busId");
        routeId = intent.getStringExtra("routeId");
        apiBase = intent.getStringExtra("apiBase");
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pendingIntent = launchIntent == null ? null : PendingIntent.getActivity(this, 0, launchIntent,
            Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("YatriBus live trip tracking")
            .setContentText("Location sharing is active. Return to YatriBus to stop sharing.")
            .setSmallIcon(getApplicationInfo().icon)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        boolean fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fine && !coarse) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            if (fine) locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 25000L, 20f, this);
            if (coarse) locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 25000L, 30f, this);
        } catch (SecurityException | IllegalArgumentException error) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onLocationChanged(Location location) {
        if (sessionId == null || apiBase == null) return;
        final JSONObject payload = new JSONObject();
        try {
            payload.put("sessionId", sessionId);
            payload.put("busId", busId);
            payload.put("routeId", routeId);
            payload.put("latitude", location.getLatitude());
            payload.put("longitude", location.getLongitude());
            payload.put("accuracyMeters", location.hasAccuracy() ? location.getAccuracy() : 999);
            if (location.hasSpeed()) payload.put("speedKmh", location.getSpeed() * 3.6);
            if (location.hasBearing()) payload.put("headingDegrees", location.getBearing());
            SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            iso.setTimeZone(TimeZone.getTimeZone("UTC"));
            payload.put("timestamp", iso.format(new Date(location.getTime())));
        } catch (Exception ignored) {
            return;
        }
        new Thread(() -> postObservation(payload)).start();
    }

    private void postObservation(JSONObject payload) {
        HttpURLConnection connection = null;
        try {
            String base = apiBase.endsWith("/") ? apiBase.substring(0, apiBase.length() - 1) : apiBase;
            URL url = new URL(base + "/api/tracking/observation");
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(bytes);
            }
            connection.getResponseCode();
        } catch (Exception ignored) {
            // GPS continues locally while offline; upload retries on the next location fix.
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "YatriBus live trip tracking", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Visible notification while the user has explicitly enabled bus journey location sharing.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override
    public void onDestroy() {
        if (locationManager != null) locationManager.removeUpdates(this);
        stopForeground(true);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
