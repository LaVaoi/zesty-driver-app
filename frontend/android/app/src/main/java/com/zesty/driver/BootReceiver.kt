package com.zesty.driver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != "android.intent.action.QUICKBOOT_POWERON"
        ) {
            return
        }

        val prefs = context.getSharedPreferences(
            LocationTrackingService.PREFS_NAME,
            Context.MODE_PRIVATE
        )
        val wasTracking = prefs.getBoolean(LocationTrackingService.KEY_TRACKING, false)
        val token = prefs.getString(LocationTrackingService.KEY_TOKEN, null)
        val apiUrl = prefs.getString(LocationTrackingService.KEY_API_URL, null)

        Log.d(TAG, "🔁 Device booted. wasTracking=$wasTracking")

        if (wasTracking && !token.isNullOrEmpty() && !apiUrl.isNullOrEmpty()) {
            val serviceIntent = Intent(context, LocationTrackingService::class.java).apply {
                this.action = LocationTrackingService.ACTION_START
                putExtra(LocationTrackingService.EXTRA_TOKEN, token)
                putExtra(LocationTrackingService.EXTRA_API_URL, apiUrl)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
                Log.d(TAG, "✅ Location tracking service restarted after boot")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to restart tracking after boot: ${e.message}")
            }
        }
    }
}