package com.winson.hermes.mobile;

import android.content.Context;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Holds a high-performance Wi-Fi lock while the app is foregrounded.
 *
 * This app is a thin client to a REMOTE gateway over a long-lived WebSocket.
 * Without the lock, Android Wi-Fi power-saving lets the radio doze between
 * packets. The lock keeps the radio awake so the connection stays stable; it's
 * released on background to spare the battery.
 */
public class MainActivity extends BridgeActivity {
    private WifiManager.WifiLock wifiLock;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HermesSocketPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY
                        : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifiLock = wifi.createWifiLock(mode, "hermes:gateway-ws");
                wifiLock.setReferenceCounted(false);
            }
        } catch (Exception ignored) {
            // Wi-Fi lock is a best-effort optimization; never block startup on it.
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        try {
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception ignored) {
        }
    }
}
