package net.appza.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must run BEFORE super.onCreate — the bridge builds its plugin
        // registry there, and anything registered afterwards never reaches
        // the WebView.
        registerPlugin(AppzaDownloadPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
