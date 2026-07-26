package com.ai.watermarkremover;


import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            Uri mediaUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (mediaUri != null) {
                Toast.makeText(this, "File received from Samsung Gallery: " + mediaUri.getLastPathSegment(), Toast.LENGTH_LONG).show();
            }
        }
    }

    /**
     * Helper to open the cleaned video file directly in Samsung's native Video Editor.
     * Called when the user taps "Edit in Samsung Video Editor".
     */
    public void openInSamsungVideoEditor(Uri cleanedVideoUri) {
        Intent intent = new Intent(Intent.ACTION_EDIT);
        intent.setDataAndType(cleanedVideoUri, "video/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

        // Target Samsung Video Editor specifically if available, else standard video editor chooser
        intent.setPackage("com.samsung.android.videoeditor");

        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            // Fallback: general system video editor chooser
            Intent chooser = Intent.createChooser(new Intent(Intent.ACTION_EDIT).setDataAndType(cleanedVideoUri, "video/*"), "Open with Samsung Video Editor");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                startActivity(chooser);
            } catch (Exception ex) {
                Toast.makeText(this, "Could not open Samsung Video Editor", Toast.LENGTH_SHORT).show();
            }
        }
    }
}
