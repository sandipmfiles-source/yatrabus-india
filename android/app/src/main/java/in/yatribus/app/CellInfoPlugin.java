package in.yatribus.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoWcdma;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.TelephonyManager;
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityNr;
import android.content.Context;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

/**
 * Returns only public radio-cell identifiers and signal strength.
 * It never reads phone numbers, SIM serials, contacts, or subscriber IDs.
 */
@CapacitorPlugin(
    name = "CellInfo",
    permissions = {
        @Permission(alias = "location", strings = {
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.ACCESS_FINE_LOCATION
        })
    }
)
public class CellInfoPlugin extends Plugin {
    @PluginMethod
    public void getCells(PluginCall call) {
        if (getPermissionState("location") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "locationPermissionCallback");
            return;
        }
        readCells(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (getPermissionState("location") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Location permission is required to read nearby mobile network cells.");
            return;
        }
        readCells(call);
    }

    private void readCells(PluginCall call) {
        try {
            Context context = getContext();
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                call.reject("Location permission is not granted.");
                return;
            }
            TelephonyManager manager = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
            if (manager == null) {
                call.reject("Mobile network information is unavailable on this device.");
                return;
            }
            List<CellInfo> infos = manager.getAllCellInfo();
            JSArray cells = new JSArray();
            if (infos != null) {
                for (CellInfo info : infos) {
                    if (info == null || !info.isRegistered()) continue;
                    JSObject cell = new JSObject();
                    String type = "UNKNOWN";
                    String mcc = null, mnc = null;
                    int area = -1;
                    long id = -1;
                    int dbm = info.getCellSignalStrength().getDbm();

                    if (info instanceof CellInfoLte) {
                        CellIdentityLte identity = ((CellInfoLte) info).getCellIdentity();
                        type = "LTE"; mcc = identity.getMccString(); mnc = identity.getMncString();
                        area = identity.getTac(); id = identity.getCi();
                    } else if (info instanceof CellInfoWcdma) {
                        CellIdentityWcdma identity = ((CellInfoWcdma) info).getCellIdentity();
                        type = "WCDMA"; mcc = identity.getMccString(); mnc = identity.getMncString();
                        area = identity.getLac(); id = identity.getCid();
                    } else if (info instanceof CellInfoGsm) {
                        CellIdentityGsm identity = ((CellInfoGsm) info).getCellIdentity();
                        type = "GSM"; mcc = identity.getMccString(); mnc = identity.getMncString();
                        area = identity.getLac(); id = identity.getCid();
                    } else if (android.os.Build.VERSION.SDK_INT >= 29 && info instanceof CellInfoNr) {
                        CellIdentityNr identity = (CellIdentityNr) ((CellInfoNr) info).getCellIdentity();
                        type = "NR"; mcc = identity.getMccString(); mnc = identity.getMncString();
                        area = identity.getTac(); id = identity.getNci();
                    }

                    if (mcc == null || mnc == null || area < 0 || id < 0 || "UNKNOWN".equals(type)) continue;
                    cell.put("radioType", type);
                    cell.put("mcc", mcc);
                    cell.put("mnc", mnc);
                    cell.put("areaCode", area);
                    cell.put("cellId", String.valueOf(id));
                    cell.put("signalDbm", dbm);
                    cells.put(cell);
                }
            }
            JSObject result = new JSObject();
            result.put("cells", cells);
            result.put("capturedAt", System.currentTimeMillis());
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("Android blocked cell information. Check location permission and system location settings.", error);
        } catch (Exception error) {
            call.reject("Unable to read mobile network cell information.", error);
        }
    }
}
