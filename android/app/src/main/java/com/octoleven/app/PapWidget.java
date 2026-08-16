package com.octoleven.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.RemoteViews;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class PapWidget extends AppWidgetProvider {

    private static final String TAG = "PapWidget";

    public static final String PREFS_NAME = "PapWidgetPrefs";
    public static final String PREF_IMAGE_URL_KEY = "last_pap_url_";
    public static final String PREF_WIDGET_USER_KEY = "widget_user_"; // "rio", "nindya", "all", "partner", "me"
    public static final String PREF_SENDER_NAME_KEY = "sender_name_";
    public static final String PREF_CAPTION_KEY = "caption_";
    public static final String PREF_TIME_KEY = "time_";
    public static final String PREF_TAG_KEY = "tag_";

    protected int getLayoutId() {
        return R.layout.pap_widget_full; // Default
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    protected void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String selectedUser = prefs.getString(PREF_WIDGET_USER_KEY + appWidgetId, "all");

        String imageUrl = prefs.getString(PREF_IMAGE_URL_KEY + selectedUser, null);
        if (imageUrl == null || imageUrl.isEmpty()) {
            imageUrl = prefs.getString(PREF_IMAGE_URL_KEY + "all", null);
        }
        if (imageUrl == null || imageUrl.isEmpty()) {
            imageUrl = prefs.getString("last_pap_url", null);
        }

        String senderName = prefs.getString(PREF_SENDER_NAME_KEY + selectedUser, "Pasangan");
        String caption = prefs.getString(PREF_CAPTION_KEY + selectedUser, "PAP hari ini buat kamu tersayang! ❤️");
        String timeText = prefs.getString(PREF_TIME_KEY + selectedUser, "Baru saja");
        String tagText = prefs.getString(PREF_TAG_KEY + selectedUser, "PAP ✨");
        int kangenCount = prefs.getInt("kangen_count", 1);
        String daysCount = prefs.getString("relationship_days", "365 Hari");

        int layoutId = getLayoutId();
        RemoteViews views = new RemoteViews(context.getPackageName(), layoutId);

        // Binding teks awal
        bindTextData(views, layoutId, senderName, caption, timeText, tagText, kangenCount, daysCount);

        // Click Action: Open MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, appWidgetId, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_image, pendingIntent);

        if (imageUrl != null && !imageUrl.isEmpty()) {
            final String finalImageUrl = imageUrl;
            new Thread(() -> {
                try {
                    URL url = new URL(finalImageUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.setConnectTimeout(6000);
                    connection.setReadTimeout(6000);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    Bitmap bitmap = BitmapFactory.decodeStream(input);

                    if (bitmap != null) {
                        new Handler(Looper.getMainLooper()).post(() -> {
                            views.setImageViewBitmap(R.id.widget_image, bitmap);
                            bindTextData(views, layoutId, senderName, caption, timeText, tagText, kangenCount, daysCount);
                            appWidgetManager.updateAppWidget(appWidgetId, views);
                        });
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Error downloading widget image: " + e.getMessage());
                }
            }).start();
        } else {
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private void bindTextData(RemoteViews views, int layoutId, String senderName, String caption, String timeText, String tagText, int kangenCount, String daysCount) {
        try {
            if (layoutId == R.layout.pap_widget_landscape) {
                views.setTextViewText(R.id.widget_sender_name, senderName + " ❤️");
                views.setTextViewText(R.id.widget_caption, "\"" + caption + "\"");
                views.setTextViewText(R.id.widget_time, timeText);
                views.setTextViewText(R.id.widget_tag, tagText);
            } else if (layoutId == R.layout.pap_widget_full) {
                views.setTextViewText(R.id.widget_sender_name, senderName + " ❤️");
                views.setTextViewText(R.id.widget_caption, caption);
                views.setTextViewText(R.id.widget_time, timeText);
                views.setTextViewText(R.id.widget_tag, tagText);
            } else if (layoutId == R.layout.pap_widget_square) {
                views.setTextViewText(R.id.widget_sender_name, senderName + " ❤️");
                views.setTextViewText(R.id.widget_caption, caption);
                views.setTextViewText(R.id.widget_tag, tagText);
            } else if (layoutId == R.layout.pap_widget_polaroid) {
                views.setTextViewText(R.id.widget_sender_name, senderName + " • " + timeText);
                views.setTextViewText(R.id.widget_caption, caption);
                views.setTextViewText(R.id.widget_tag, tagText);
            } else if (layoutId == R.layout.pap_widget_kangen) {
                views.setTextViewText(R.id.widget_sender_name, senderName);
                views.setTextViewText(R.id.widget_time, timeText);
                views.setTextViewText(R.id.widget_kangen_count, "❤️ " + kangenCount + "x");
            } else if (layoutId == R.layout.pap_widget_countdown) {
                views.setTextViewText(R.id.widget_days_count, daysCount);
                views.setTextViewText(R.id.widget_caption, caption);
                views.setTextViewText(R.id.widget_tag, tagText);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error binding text views for widget layout: " + e.getMessage());
        }
    }
}
