package com.mob.mobdeck.companion;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MobLauncherNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        dispatchDeepLink(intent);
    }

    private void dispatchDeepLink(Intent intent) {
        if (intent == null || intent.getDataString() == null || bridge == null) {
            return;
        }

        PluginHandle handle = bridge.getPlugin("MobLauncherNative");

        if (handle != null && handle.getInstance() instanceof MobLauncherNativePlugin) {
            ((MobLauncherNativePlugin) handle.getInstance()).handleDeepLink(intent.getDataString());
        }
    }
}
