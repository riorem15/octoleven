package com.octoleven.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    private static final String TAG = "WidgetPlugin";

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String imageUrl = call.getString("imageUrl");

        Context context = getContext();
        String sender = call.getString("sender", "all"); // "all", "partner", "me", "rio", "nindya"
        String senderName = call.getString("senderName", "Pasangan");
        String caption = call.getString("caption", "");
        String timeText = call.getString("timeText", "Baru saja");
        String tagText = call.getString("tagText", "PAP ✨");
        String daysCount = call.getString("daysCount", "365 Hari");

        SharedPreferences prefs = context.getSharedPreferences(PapWidget.PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        // Simpan ke konfigurasi spesifik kategori pengirim
        if (imageUrl != null && !imageUrl.isEmpty()) {
            editor.putString(PapWidget.PREF_IMAGE_URL_KEY + sender, imageUrl);
            editor.putString(PapWidget.PREF_IMAGE_URL_KEY + "all", imageUrl);
            editor.putString("last_pap_url", imageUrl);
        }

        editor.putString(PapWidget.PREF_SENDER_NAME_KEY + sender, senderName);
        editor.putString(PapWidget.PREF_CAPTION_KEY + sender, caption);
        editor.putString(PapWidget.PREF_TIME_KEY + sender, timeText);
        editor.putString(PapWidget.PREF_TAG_KEY + sender, tagText);

        editor.putString(PapWidget.PREF_SENDER_NAME_KEY + "all", senderName);
        editor.putString(PapWidget.PREF_CAPTION_KEY + "all", caption);
        editor.putString(PapWidget.PREF_TIME_KEY + "all", timeText);
        editor.putString(PapWidget.PREF_TAG_KEY + "all", tagText);

        editor.putString("relationship_days", daysCount);
        editor.apply();

        // Broadcast intent agar semua jenis widget mengunduh gambar dan merender UI
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
                Log.e(TAG, "Error updating widget " + widgetClass.getSimpleName(), e);
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void setWidgetCategory(PluginCall call) {
        String category = call.getString("category", "all"); // "all", "partner", "me"
        Context context = getContext();
        SharedPreferences prefs = context.getSharedPreferences(PapWidget.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("default_widget_category", category).apply();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("category", category);
        call.resolve(ret);
    }

    @PluginMethod
    public void pinWidget(PluginCall call) {
        Context context = getContext();
        String widgetType = call.getString("widgetType", "landscape").toLowerCase();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (appWidgetManager.isRequestPinAppWidgetSupported()) {
                Class<?> targetClass;
                switch (widgetType) {
                    case "full":
                        targetClass = PapWidgetFull.class;
                        break;
                    case "square":
                    case "small":
                        targetClass = PapWidgetSquare.class;
                        break;
                    case "polaroid":
                        targetClass = PapWidgetPolaroid.class;
                        break;
                    case "kangen":
                        targetClass = PapWidgetKangen.class;
                        break;
                    case "countdown":
                        targetClass = PapWidgetCountdown.class;
                        break;
                    case "landscape":
                    default:
                        targetClass = PapWidgetLandscape.class;
                        break;
                }

                ComponentName myProvider = new ComponentName(context, targetClass);
                appWidgetManager.requestPinAppWidget(myProvider, null, null);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("widgetType", widgetType);
                ret.put("targetClass", targetClass.getSimpleName());
                call.resolve(ret);
            } else {
                call.reject("Fitur Pin Widget tidak didukung pada launcher perangkat ini.");
            }
        } else {
            call.reject("Fitur Pin Widget membutuhkan Android 8.0 (Oreo) ke atas.");
        }
    }
}
