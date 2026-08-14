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
        
        // 1. Simpan URL ke SharedPreferences
        SharedPreferences prefs = context.getSharedPreferences(PapWidget.PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("last_pap_url", imageUrl); // umum
        editor.putString(PapWidget.PREF_IMAGE_URL_KEY + sender, imageUrl); // spesifik user
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
}
