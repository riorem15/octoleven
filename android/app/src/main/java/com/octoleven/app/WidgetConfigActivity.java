package com.octoleven.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.widget.Button;
import android.widget.RadioButton;
import android.widget.RadioGroup;

public class WidgetConfigActivity extends Activity {

    private int appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Set the result to CANCELED. This will cause the widget host to cancel
        // out of the widget placement if the user presses the back button.
        setResult(RESULT_CANCELED);

        setContentView(R.layout.activity_widget_config);

        // Find the widget id from the intent.
        Intent intent = getIntent();
        Bundle extras = intent.getExtras();
        if (extras != null) {
            appWidgetId = extras.getInt(
                    AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        }

        // If this activity was started with an intent without an app widget ID, finish with an error.
        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish();
            return;
        }

        Button btnSave = findViewById(R.id.btnSaveConfig);
        RadioGroup radioGroup = findViewById(R.id.radioGroupUsers);

        btnSave.setOnClickListener(v -> {
            int selectedId = radioGroup.getCheckedRadioButtonId();
            String selectedUser = "all";
            
            if (selectedId == R.id.radioRio) {
                selectedUser = "rio";
            } else if (selectedId == R.id.radioNindya) {
                selectedUser = "nindya";
            }

            // Save the selection
            SharedPreferences prefs = getSharedPreferences(PapWidget.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(PapWidget.PREF_WIDGET_USER_KEY + appWidgetId, selectedUser).apply();

            // It is the responsibility of the configuration activity to update the app widget
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(this);
            
            // Trigger update ke 6 class widget agar langsung refresh
            Class<?>[] widgetClasses = {
                PapWidgetLandscape.class,
                PapWidgetFull.class,
                PapWidgetSquare.class,
                PapWidgetPolaroid.class,
                PapWidgetKangen.class,
                PapWidgetCountdown.class
            };
            for (Class<?> widgetClass : widgetClasses) {
                Intent updateIntent = new Intent(this, widgetClass);
                updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, new int[]{appWidgetId});
                sendBroadcast(updateIntent);
            }
            
            Intent resultValue = new Intent();
            resultValue.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            setResult(RESULT_OK, resultValue);
            finish();
        });
    }
}
