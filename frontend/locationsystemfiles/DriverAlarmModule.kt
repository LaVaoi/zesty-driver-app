package com.zesty.driver

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DriverAlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DriverAlarm"

    @ReactMethod
    fun startAlarm() {
        val intent = Intent(reactContext, DriverAlarmService::class.java).apply {
            action = DriverAlarmService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopAlarm() {
        val intent = Intent(reactContext, DriverAlarmService::class.java).apply {
            action = DriverAlarmService.ACTION_STOP
        }
        reactContext.startService(intent)
    }
}