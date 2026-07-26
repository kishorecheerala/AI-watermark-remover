package com.ai.watermarkremover;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class CleanEdgeWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_CLEAN_LATEST = "com.ai.watermarkremover.ACTION_CLEAN_LATEST";
    public static final String ACTION_OPEN_EDITOR = "com.ai.watermarkremover.ACTION_OPEN_EDITOR";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.edge_panel_widget);

            // Intent for "⚡ Clean Latest Item" button
            Intent cleanIntent = new Intent(context, CleanEdgeWidgetProvider.class);
            cleanIntent.setAction(ACTION_CLEAN_LATEST);
            PendingIntent cleanPendingIntent = PendingIntent.getBroadcast(
                    context, 0, cleanIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.btn_clean_latest, cleanPendingIntent);

            // Intent for "🎬 Open Samsung Editor" button
            Intent editorIntent = new Intent(context, MainActivity.class);
            editorIntent.setAction(Intent.ACTION_EDIT);
            editorIntent.setPackage("com.samsung.android.videoeditor");
            editorIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent editorPendingIntent = PendingIntent.getActivity(
                    context, 1, editorIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.btn_open_samsung_editor, editorPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_CLEAN_LATEST.equals(intent.getAction())) {
            Intent mainIntent = new Intent(context, MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(mainIntent);
        }
    }
}
