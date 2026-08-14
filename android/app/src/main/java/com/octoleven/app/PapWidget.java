package com.octoleven.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;
import android.content.SharedPreferences;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class PapWidget extends AppWidgetProvider {

    // Kunci untuk menyimpan URL gambar terakhir dari Web App
    public static final String PREFS_NAME = "PapWidgetPrefs";
    public static final String PREF_IMAGE_URL_KEY = "last_pap_url_";
    public static final String PREF_WIDGET_USER_KEY = "widget_user_"; // "rio", "nindya", "all"
    public static final String PREF_SENDER_NAME_KEY = "sender_name_";
    public static final String PREF_CAPTION_KEY = "caption_";
    public static final String PREF_TIME_KEY = "time_";
    public static final String PREF_TAG_KEY = "tag_";

    protected int getLayoutId() {
        return R.layout.pap_widget_full; // Default
    }

    protected void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Ambil pengaturan user untuk widget ini
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String selectedUser = prefs.getString(PREF_WIDGET_USER_KEY + appWidgetId, "all");
        
        // Ambil URL terakhir berdasarkan user
        String imageUrl = prefs.getString(PREF_IMAGE_URL_KEY + selectedUser, null);

        // Ambil data tambahan
        String senderName = prefs.getString(PREF_SENDER_NAME_KEY + selectedUser, "Pasangan");
        String caption = prefs.getString(PREF_CAPTION_KEY + selectedUser, "");
        String timeText = prefs.getString(PREF_TIME_KEY + selectedUser, "Baru saja");
        String tagText = prefs.getString(PREF_TAG_KEY + selectedUser, "PAP ✨");

        // Buat View untuk Widget
        RemoteViews views = new RemoteViews(context.getPackageName(), getLayoutId());

        // Kalau ada URL, download gambarnya
        if (imageUrl != null && !imageUrl.isEmpty()) {
            
            final String finalImageUrl = imageUrl; // Fix for lambda expression
            // Download gambar di thread terpisah agar tidak memblokir UI
            new Thread(() -> {
                try {
                    URL url = new URL(finalImageUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    Bitmap bitmap = BitmapFactory.decodeStream(input);

                    // Update UI di main thread
                    new Handler(Looper.getMainLooper()).post(() -> {
                        views.setImageViewBitmap(R.id.widget_image, bitmap);
                        
                        if (getLayoutId() == R.layout.pap_widget_landscape) {
                            views.setTextViewText(R.id.widget_sender_name, senderName + " ❤️");
                            views.setTextViewText(R.id.widget_caption, "\"" + caption + "\"");
                            views.setTextViewText(R.id.widget_time, timeText);
                            views.setTextViewText(R.id.widget_tag, tagText);
                        } else {
                            // Untuk widget tipe lain yang hanya punya widget_text
                            views.setTextViewText(R.id.widget_text, "");
                        }
                        
                        appWidgetManager.updateAppWidget(appWidgetId, views);
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }).start();
        } else {
            if (getLayoutId() != R.layout.pap_widget_landscape) {
                views.setTextViewText(R.id.widget_text, "Belum ada PAP");
            } else {
                views.setTextViewText(R.id.widget_caption, "\"Belum ada PAP dari " + selectedUser + "\"");
                views.setTextViewText(R.id.widget_sender_name, "Pasangan ❤️");
                views.setTextViewText(R.id.widget_time, "-");
                views.setTextViewText(R.id.widget_tag, "Menunggu...");
            }
        }

        // Aksi ketika Widget di-klik: Buka aplikasi utama
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_image, pendingIntent);
        
        // Untuk landscape, klik tombol heart buka aplikasi juga
        if (getLayoutId() == R.layout.pap_widget_landscape) {
             views.setOnClickPendingIntent(R.id.widget_heart_btn, pendingIntent);
        }

        // Update widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }
}
