package com.mob.mobdeck.companion;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

@CapacitorPlugin(name = "MobLauncherNative")
public class MobLauncherNativePlugin extends Plugin {
    private static final String PREFS_NAME = "mobdeck_companion";
    private String pendingDeepLink = "";

    @Override
    public void load() {
        Intent intent = getActivity().getIntent();

        if (intent != null && intent.getDataString() != null) {
            pendingDeepLink = intent.getDataString();
        }
    }

    @PluginMethod
    public void secureGet(PluginCall call) {
        String key = call.getString("key", "");
        JSObject result = new JSObject();

        result.put("value", prefs().getString(key, ""));
        call.resolve(result);
    }

    @PluginMethod
    public void secureSet(PluginCall call) {
        String key = call.getString("key", "");
        String value = call.getString("value", "");

        if (key.isEmpty()) {
            call.reject("Chave invalida.");
            return;
        }

        prefs().edit().putString(key, value).apply();
        call.resolve();
    }

    @PluginMethod
    public void secureRemove(PluginCall call) {
        String key = call.getString("key", "");

        if (!key.isEmpty()) {
            prefs().edit().remove(key).apply();
        }

        call.resolve();
    }

    @PluginMethod
    public void sendWakePacket(PluginCall call) {
        String mac = call.getString("mac", "");
        String broadcast = call.getString("broadcast", "255.255.255.255");
        int port = call.getInt("port", 9);

        execute(() -> {
            try {
                byte[] packet = createMagicPacket(mac);
                InetAddress address = InetAddress.getByName(broadcast);

                try (DatagramSocket socket = new DatagramSocket()) {
                    socket.setBroadcast(true);
                    socket.send(new DatagramPacket(packet, packet.length, address, port));
                }

                JSObject result = new JSObject();
                result.put("ok", true);
                call.resolve(result);
            } catch (Exception error) {
                call.reject(error.getMessage() != null ? error.getMessage() : "Wake-on-LAN falhou.");
            }
        });
    }

    @PluginMethod
    public void scanQr(PluginCall call) {
        IntentIntegrator integrator = new IntentIntegrator(getActivity());

        integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
        integrator.setPrompt("Ler QR do MOB Deck");
        integrator.setBeepEnabled(false);
        integrator.setOrientationLocked(false);

        startActivityForResult(call, integrator.createScanIntent(), "scanQrResult");
    }

    @ActivityCallback
    private void scanQrResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        IntentResult scanResult = IntentIntegrator.parseActivityResult(
            result.getResultCode(),
            result.getData()
        );

        if (scanResult == null || scanResult.getContents() == null) {
            call.reject("Leitura cancelada.");
            return;
        }

        JSObject payload = new JSObject();
        payload.put("text", scanResult.getContents());
        call.resolve(payload);
    }

    @PluginMethod
    public void consumeDeepLink(PluginCall call) {
        JSObject result = new JSObject();

        result.put("url", pendingDeepLink);
        pendingDeepLink = "";
        call.resolve(result);
    }

    public void handleDeepLink(String url) {
        pendingDeepLink = url == null ? "" : url;

        JSObject payload = new JSObject();
        payload.put("url", pendingDeepLink);
        notifyListeners("deepLink", payload, true);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private byte[] createMagicPacket(String mac) {
        String clean = mac == null ? "" : mac.replaceAll("[^a-fA-F0-9]", "");

        if (clean.length() != 12) {
            throw new IllegalArgumentException("MAC invalido para Wake-on-LAN.");
        }

        byte[] macBytes = new byte[6];

        for (int index = 0; index < 6; index++) {
            macBytes[index] = (byte) Integer.parseInt(clean.substring(index * 2, index * 2 + 2), 16);
        }

        byte[] packet = new byte[102];

        for (int index = 0; index < 6; index++) {
            packet[index] = (byte) 0xFF;
        }

        for (int block = 1; block <= 16; block++) {
            System.arraycopy(macBytes, 0, packet, block * 6, macBytes.length);
        }

        return packet;
    }
}
