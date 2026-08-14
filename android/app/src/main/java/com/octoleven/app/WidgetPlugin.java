package com.octoleven.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetPlugin")
public class WidgetPlugin extends Plugin {

    @PluginMethod
    public void updateWidget(PluginCall call) {
        String imageUrl = call.getString("imageUrl");

        if (imageUrl == null) {
            call.reject("Image URL is required");
            return;
        }

        Context context = getContext();

        String sender = call.getString("sender", "all"); // "rio", "nindya"
        String senderName = call.getString("senderName", "Pasangan");
        String caption = call.getString("caption", "");
        String timeText = call.getString("timeText", "Baru saja");
        String tagText = call.getString("tagText", "PAP ✨");
        
        // 1. Simpan URL ke SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PapWidget.PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("last_pap_url", imageUrl); // umum
        editor.putString(PapWidget.PREF_IMAGE_URL_KEY + sender, imageUrl); // spesifik user
        editor.putString(PapWidget.PREF_SENDER_NAME_KEY + sender, senderName);
        editor.putString(PapWidget.PREF_CAPTION_KEY + sender, caption);
        editor.putString(PapWidget.PREF_TIME_KEY + sender, timeText);
        editor.putString(PapWidget.PREF_TAG_KEY + sender, tagText);
        editor.apply();

        // 2. Kirim sinyal broadcast (Intent) untuk memaksa Widget Update ke 3 class
        AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
        
        Class<?>[] widgetClasses = {PapWidgetLandscape.class, PapWidgetFull.class, PapWidgetSquare.class};
        
        for (Class<?> widgetClass : widgetClasses) {
            Intent intent = new Intent(context, widgetClass);
            intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            int[] ids = widgetManager.getAppWidgetIds(new ComponentName(context, widgetClass));
            if (ids != null && ids.length > 0) {
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(intent);
            }
        }

        // Beri tahu Web App bahwa tugas sukses
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void pinWidget(PluginCall call) {
        Context context = getContext();
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION.CODES.O) {
            if (appWidgetManager.isRequestPinAppWidgetSupported()) {
                ComponentName myProvider = new ComponentName(context, PapWidgetLandscape.class);
                appWidgetManager.requestPinAppWidget(myProvider, null, null);
                call.resolve();
            } else {
                call.reject("Pin widget tidak didukung di perangkat ini.");
            }
        } else {
            call.reject("Fitur ini membutuhkan Android 8.0 (Oreo) ke atas.");
        }
    }
}
