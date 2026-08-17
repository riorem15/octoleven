package com.octoleven.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class OctoMessagingService extends FirebaseMessagingService {

    private static final String TAG = "OctoMessagingService";
    public static final String CHANNEL_ID = "octo_couple_channel";
    public static final String CHANNEL_NAME = "Notifikasi Pasangan Octoleven";
    public static final String CHANNEL_DESC = "Pemberitahuan PAP, Rindu, Komentar, Mood & Agenda Pasangan";

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Log.d(TAG, "Pesan masuk dari FCM: " + remoteMessage.getFrom());

        String title = null;
        String body = null;
        String event = "default";
        String imageUrl = null;
        String senderName = "Pasangan";
        String caption = "";
        String tagText = "PAP ✨";

        // 1. Ekstrak dari Payload Notification jika ada
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }

        // 2. Ekstrak dari Data Payload (prioritas tinggi untuk kustomisasi & background)
        if (remoteMessage.getData().size() > 0) {
            Map<String, String> data = remoteMessage.getData();
            Log.d(TAG, "Data payload: " + data);

            if (data.containsKey("title") && (title == null || title.isEmpty())) {
                title = data.get("title");
            }
            if (data.containsKey("body") && (body == null || body.isEmpty())) {
                body = data.get("body");
            }

            event = data.getOrDefault("event", "default");
            imageUrl = data.get("imageUrl");
            senderName = data.getOrDefault("senderName", "Pasangan");
            caption = data.getOrDefault("caption", "");
            tagText = data.getOrDefault("tagText", "PAP ✨");

            // Handle widget update
            if ("true".equals(data.get("widget_update")) || "new_pap".equals(event) || "kangen".equals(event)) {
                updateWidgetData(imageUrl, senderName, caption, tagText, event);
            }
        }

        // Default title & body jika kosong
        if (title == null || title.isEmpty()) {
            if ("new_pap".equals(event)) {
                title = "PAP Baru Masuk! 📸";
                body = senderName + " baru saja mengirim PAP spesial untukmu!";
            } else if ("kangen".equals(event) || "love_poke".equals(event)) {
                title = "Panggilan Rindu! 🥺❤️";
                body = senderName + " lagi kangen banget sama kamu!";
            } else if ("comment".equals(event)) {
                title = "Bisikan Baru di PAP! 💬";
                body = senderName + ": " + (caption.isEmpty() ? "mengomentari fotomu" : caption);
            } else if ("reaction".equals(event)) {
                title = "Reaksi Manis! " + tagText;
                body = senderName + " menyukai PAP kamu!";
            } else if ("agenda".equals(event)) {
                title = "Pengingat Kencan! 🍿";
                body = caption.isEmpty() ? "Ada jadwal kencan baru bersama pasangan!" : caption;
            } else if ("mood".equals(event)) {
                title = "Status Mood Pasangan ✨";
                body = senderName + " sekarang lagi " + tagText + " " + caption;
            } else {
                title = "Octoleven Couple ❤️";
                body = "Ada pembaruan manis dari pasanganmu!";
            }
        }

        // 3. Tampilkan Notifikasi Sistem Android yang Nyata & Terus Bekerja
        showSystemNotification(title, body, imageUrl, event);
    }

    private void showSystemNotification(String title, String body, String imageUrl, String event) {
        Context context = getApplicationContext();
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        // Buat Notification Channel untuk Android 8.0 (Oreo) ke atas
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(CHANNEL_DESC);
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setShowBadge(true);
            channel.setVibrationPattern(new long[]{0, 250, 150, 250});
            
            android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
                    .build();
            channel.setSound(defaultSoundUri, audioAttributes);
            
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }

        // Intent ketika notifikasi ditekan -> Buka MainActivity
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("event", event);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                (int) System.currentTimeMillis(),
                intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setColor(0xFFFF6B8A)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setSound(defaultSoundUri)
                .setVibrate(new long[]{0, 250, 150, 250})
                .setDefaults(android.app.Notification.DEFAULT_ALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setContentIntent(pendingIntent);

        // Jika ada gambar (misal PAP), coba muat sebagai BigPictureStyle
        if (imageUrl != null && !imageUrl.isEmpty()) {
            try {
                Bitmap bitmap = getBitmapFromUrl(imageUrl);
                if (bitmap != null) {
                    notificationBuilder.setStyle(new NotificationCompat.BigPictureStyle()
                            .bigPicture(bitmap)
                            .setSummaryText(body));
                    notificationBuilder.setLargeIcon(bitmap);
                } else {
                    notificationBuilder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
                }
            } catch (Exception e) {
                notificationBuilder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
            }
        } else {
            notificationBuilder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
        }

        int notificationId = (int) (System.currentTimeMillis() % 100000);
        if (notificationManager != null) {
            notificationManager.notify(notificationId, notificationBuilder.build());
        }
    }

    private Bitmap getBitmapFromUrl(String imageUrl) {
        try {
            URL url = new URL(imageUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.connect();
            InputStream input = connection.getInputStream();
            return BitmapFactory.decodeStream(input);
        } catch (Exception e) {
            Log.w(TAG, "Gagal mengunduh gambar thumbnail notifikasi: " + e.getMessage());
            return null;
        }
    }

    private void updateWidgetData(String imageUrl, String senderName, String caption, String tagText, String event) {
        Context context = getApplicationContext();

        SharedPreferences prefs = context.getSharedPreferences(PapWidget.PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        if (senderName == null) senderName = "Pasangan";
        if (caption == null) caption = "";
        if (tagText == null) tagText = "PAP ✨";
        String timeText = "Baru saja";

        String[] configs = {"rio", "nindya", "all", "partner", "me"};
        for (String conf : configs) {
            if (imageUrl != null && !imageUrl.isEmpty()) {
                editor.putString(PapWidget.PREF_IMAGE_URL_KEY + conf, imageUrl);
            }
            editor.putString(PapWidget.PREF_SENDER_NAME_KEY + conf, senderName);
            editor.putString(PapWidget.PREF_CAPTION_KEY + conf, caption);
            editor.putString(PapWidget.PREF_TIME_KEY + conf, timeText);
            editor.putString(PapWidget.PREF_TAG_KEY + conf, tagText);
        }

        if (imageUrl != null && !imageUrl.isEmpty()) {
            editor.putString("last_pap_url", imageUrl);
        }

        if ("kangen".equals(event) || "love_poke".equals(event)) {
            int kangenCount = prefs.getInt("kangen_count", 0) + 1;
            editor.putInt("kangen_count", kangenCount);
            editor.putString("last_kangen_sender", senderName);
            editor.putString("last_kangen_time", "Baru saja");
        }

        editor.apply();

        Log.d(TAG, "Data widget tersimpan. Memancarkan broadcast update ke semua widget...");

        AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
        Class<?>[] widgetClasses = {
                PapWidgetLandscape.class,
                PapWidgetFull.class,
                PapWidgetSquare.class,
                PapWidgetPolaroid.class,
                PapWidgetKangen.class,
                PapWidgetCountdown.class
        };

        for (Class<?> widgetClass : widgetClasses) {
            try {
                Intent intent = new Intent(context, widgetClass);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                int[] ids = widgetManager.getAppWidgetIds(new ComponentName(context, widgetClass));
                if (ids != null && ids.length > 0) {
                    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                    context.sendBroadcast(intent);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error broadcasting widget update for " + widgetClass.getSimpleName(), e);
            }
        }
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed FCM Token: " + token);
        SharedPreferences prefs = getSharedPreferences(PapWidget.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("device_fcm_token", token).apply();
    }
}
