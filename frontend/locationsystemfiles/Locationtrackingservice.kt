package com.zesty.driver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.google.android.gms.location.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class LocationTrackingService : Service() {

    companion object {
        const val TAG = "LocationTrackingService"
        const val CHANNEL_ID = "location-tracking"
        const val NOTIFICATION_ID = 111222
        const val ACTION_START = "com.zesty.driver.ACTION_START_LOCATION"
        const val ACTION_STOP = "com.zesty.driver.ACTION_STOP_LOCATION"
        const val EXTRA_TOKEN = "driver_token"
        const val EXTRA_API_URL = "api_url"
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private val httpClient = OkHttpClient()

    private var driverToken: String = ""
    private var apiUrl: String = ""

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🟢 onCreate called")
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🟢 onStartCommand called, action=${intent?.action}")
        when (intent?.action) {
            ACTION_START -> {
                driverToken = intent.getStringExtra(EXTRA_TOKEN) ?: ""
                apiUrl = intent.getStringExtra(EXTRA_API_URL) ?: ""
                Log.d(TAG, "🟢 Starting - token length=${driverToken.length}, apiUrl=$apiUrl")
                startAsForegroundService()
                startLocationUpdates()
            }
            ACTION_STOP -> {
                Log.d(TAG, "🔴 Stopping service")
                stopLocationUpdates()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "🔴 onDestroy called")
        stopLocationUpdates()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startAsForegroundService() {
        Log.d(TAG, "🟢 startAsForegroundService called")
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Zesty Driver")
            .setContentText("You are online - location is being tracked")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        Log.d(TAG, "🟢 Foreground service started")
    }

    private fun startLocationUpdates() {
        Log.d(TAG, "🟢 startLocationUpdates called")
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            15000L
        ).apply {
            setMinUpdateDistanceMeters(0f)
            setGranularity(Granularity.GRANULARITY_PERMISSION_LEVEL)
            setWaitForAccurateLocation(false)
        }.build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                Log.d(TAG, "📍 onLocationResult called!")
                val location: Location = result.lastLocation ?: run {
                    Log.d(TAG, "⚠️ lastLocation is null")
                    return
                }
                Log.d(TAG, "📍 Got location: lat=${location.latitude}, lon=${location.longitude}")
                sendLocationToBackend(location.latitude, location.longitude)
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                Log.d(TAG, "📍 Location available: ${availability.isLocationAvailable}")
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            Log.d(TAG, "🟢 requestLocationUpdates registered successfully")
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ SecurityException - no location permission: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Exception in startLocationUpdates: ${e.message}")
        }
    }

    private fun stopLocationUpdates() {
        if (::locationCallback.isInitialized) {
            fusedLocationClient.removeLocationUpdates(locationCallback)
            Log.d(TAG, "🔴 Location updates stopped")
        }
    }

    private fun sendLocationToBackend(latitude: Double, longitude: Double) {
        Log.d(TAG, "📤 sendLocationToBackend called: lat=$latitude, lon=$longitude")
        if (driverToken.isEmpty() || apiUrl.isEmpty()) {
            Log.e(TAG, "❌ Token or apiUrl is empty! token=${driverToken.length} chars, url=$apiUrl")
            return
        }

        val json = JSONObject().apply {
            put("latitude", latitude)
            put("longitude", longitude)
        }

        val body = json.toString().toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url(apiUrl)
            .put(body)
            .addHeader("Authorization", "Bearer $driverToken")
            .addHeader("Content-Type", "application/json")
            .build()

        Log.d(TAG, "📤 Sending HTTP request to $apiUrl")
        httpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "❌ HTTP request failed: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "✅ HTTP response: ${response.code}")
                response.close()
            }
        })
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            if (manager.getNotificationChannel(CHANNEL_ID) == null) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    "Location Tracking",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Shows while driver is online and tracking is active"
                    setSound(null, null)
                    enableVibration(false)
                }
                manager.createNotificationChannel(channel)
            }
        }
        Log.d(TAG, "🟢 Notification channel created")
    }
}