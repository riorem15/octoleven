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

    protected int getLayoutId() {
        return R.layout.pap_widget_full; // Default
    }

    protected void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Ambil pengaturan user untuk widget ini
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String selectedUser = prefs.getString(PREF_WIDGET_USER_KEY + appWidgetId, "all");
        
        // Ambil URL terakhir berdasarkan user
        String imageUrl = prefs.getString(PREF_IMAGE_URL_KEY + selectedUser, null);
        if (imageUrl == null) {
            // Fallback ke yang umum jika spesifik tidak ada
            imageUrl = prefs.getString("last_pap_url", null);
        }

        // Buat View untuk Widget
        RemoteViews views = new RemoteViews(context.getPackageName(), getLayoutId());

        // Kalau ada URL, download gambarnya
        if (imageUrl != null && !imageUrl.isEmpty()) {
            views.setTextViewText(R.id.widget_text, "PAP Baru!");
            
            // Download gambar di thread terpisah agar tidak memblokir UI
            new Thread(() -> {
                try {
                    URL url = new URL(imageUrl);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    Bitmap bitmap = BitmapFactory.decodeStream(input);

                    // Update UI di main thread
                    new Handler(Looper.getMainLooper()).post(() -> {
                        views.setImageViewBitmap(R.id.widget_image, bitmap);
                        views.setTextViewText(R.id.widget_text, ""); // Sembunyikan teks kalau gambar berhasil
                        appWidgetManager.updateAppWidget(appWidgetId, views);
                    });
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }).start();
        } else {
            views.setTextViewText(R.id.widget_text, "Belum ada PAP");
        }

        // Aksi ketika Widget di-klik: Buka aplikasi utama
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_image, pendingIntent);

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
