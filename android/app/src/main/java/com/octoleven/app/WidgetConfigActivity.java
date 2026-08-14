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
            
            // We need to trigger an update manually since the widget provider's onUpdate is not called after config
            // Because we don't know exactly which class was used (Landscape, Full, Square), we just broadcast an update
            // Actually, we can just instantiate the base class or call updateAppWidget if it was public/static.
            // Since it's protected, let's just trigger a broadcast.
            
            Intent resultValue = new Intent();
            resultValue.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            setResult(RESULT_OK, resultValue);
            finish();
        });
    }
}
