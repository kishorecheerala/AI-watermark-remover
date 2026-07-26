package com.ai.watermarkremover;


import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

/**
 * Android activity to capture Samsung S-Pen Air Commands, Smart Select floating crops,
 * and text selection intent actions (`android.intent.action.PROCESS_TEXT`).
 */
public class SPenSmartSelectActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleSPenAction(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleSPenAction(intent);
    }

    private void handleSPenAction(Intent intent) {
        if (intent == null) {
            finish();
            return;
        }

        String action = intent.getAction();
        if (Intent.ACTION_PROCESS_TEXT.equals(action) || Intent.ACTION_SEND.equals(action)) {
            Uri cropUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (cropUri != null) {
                Toast.makeText(this, "S-Pen Smart Select Region Captured! Cleaning...", Toast.LENGTH_SHORT).show();
                Intent mainIntent = new Intent(this, MainActivity.class);
                mainIntent.setAction(Intent.ACTION_SEND);
                mainIntent.putExtra(Intent.EXTRA_STREAM, cropUri);
                mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(mainIntent);
            }
        }
        finish();
    }
}
