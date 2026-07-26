package com.raiw.watermarkremover;

import android.annotation.TargetApi;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import android.widget.Toast;

@TargetApi(Build.VERSION_CODES.N)
public class CleanTileService extends TileService {

    @Override
    public void onClick() {
        super.onClick();
        Tile tile = getQsTile();
        if (tile != null) {
            tile.setState(Tile.STATE_ACTIVE);
            tile.updateTile();
        }

        Uri latestMediaUri = getLatestMediaUri();
        if (latestMediaUri != null) {
            Toast.makeText(this, "Cleaning newest item in Samsung Gallery...", Toast.LENGTH_LONG).show();

            Intent intent = new Intent(this, MainActivity.class);
            intent.setAction(Intent.ACTION_SEND);
            intent.putExtra(Intent.EXTRA_STREAM, latestMediaUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivityAndCollapse(intent);
        } else {
            Toast.makeText(this, "No recent images or videos found in Gallery", Toast.LENGTH_SHORT).show();
        }

        if (tile != null) {
            tile.setState(Tile.STATE_INACTIVE);
            tile.updateTile();
        }
    }

    private Uri getLatestMediaUri() {
        Uri mediaUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
        String[] projection = new String[]{MediaStore.Video.Media._ID, MediaStore.Video.Media.DATE_ADDED};
        String sortOrder = MediaStore.Video.Media.DATE_ADDED + " DESC";

        try (Cursor cursor = getContentResolver().query(mediaUri, projection, null, null, sortOrder)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Video.Media._ID);
                long id = cursor.getLong(idColumn);
                return Uri.withAppendedPath(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, String.valueOf(id));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Fallback to images
        mediaUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        projection = new String[]{MediaStore.Images.Media._ID, MediaStore.Images.Media.DATE_ADDED};
        sortOrder = MediaStore.Images.Media.DATE_ADDED + " DESC";

        try (Cursor cursor = getContentResolver().query(mediaUri, projection, null, null, sortOrder)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
                long id = cursor.getLong(idColumn);
                return Uri.withAppendedPath(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, String.valueOf(id));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return null;
    }
}
