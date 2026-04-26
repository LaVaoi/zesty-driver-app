// utils/fcmService.js
import admin from 'firebase-admin';

let isInitialized = false;

try {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not found in .env file');
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key
      .replace(/\\\\n/g, '\n')
      .replace(/\\n/g, '\n');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    isInitialized = true;
    console.log('✅ Firebase Admin SDK already initialized');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  isInitialized = false;
}

/**
 * Send FCM push notifications to multiple devices
 * For new orders, we send a data-only message to trigger the background task,
 * which will then play a looping sound and show a local notification.
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {string} title - Notification title (used in data payload)
 * @param {string} body - Notification body (used in data payload)
 * @param {object} data - Optional data payload
 */
export async function sendFCMNotification(tokens, title, body, data = {}) {
  if (!isInitialized) {
    console.error('❌ Firebase Admin SDK not initialized.');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
    return { success: false, error: 'No tokens provided' };
  }

  const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
  const validTokens = tokenArray.filter(token => token && typeof token === 'string' && token.trim().length > 0);
  
  if (validTokens.length === 0) return { success: false, error: 'No valid tokens' };

  // Detect if this is a new order notification
  const isNewOrder = data.type === 'new_order' || data.notification_type === 'new_order';

  try {
    const BATCH_SIZE = 500;
    let totalSuccess = 0;
    let totalFailure = 0;

    for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
      const batchTokens = validTokens.slice(i, i + BATCH_SIZE);
      
      // Build the message payload
      const message = {
        tokens: batchTokens,
        // All data fields MUST be strings
        data: {
          // Include title and body in data so background task can use them
          title: String(title || 'Notification'),
          body: String(body || ''),
          // Merge additional data, ensuring all values are strings
          ...Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {}),
        },
      };

      // For new orders, we want to ensure the device wakes up and the background task runs.
      // Add platform-specific configurations to wake the app.
      if (isNewOrder) {
        // Android: high priority wakes the device, no notification payload
        message.android = {
          priority: 'high',
        };

        // iOS: use content-available to wake the app in background
        message.apns = {
          payload: {
            aps: {
              'content-available': 1,
              sound: 'default', // required for background, but not used for sound
            },
          },
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'background',
          },
        };
      } else {
        // For non‑new‑order messages, you might still want a system notification.
        // You can keep the original behaviour or adjust as needed.
        // For simplicity, we'll keep the original structure but without the
        // android.notification block to avoid overriding.
        message.notification = {
          title: String(title || 'Notification'),
          body: String(body || ''),
        };
        message.android = {
          priority: 'high',
          // Optionally include notification settings if you want a system notification
          // but that might interfere with background tasks. For now, leave it out.
        };
        message.apns = {
          payload: {
            aps: {
              alert: {
                title: String(title || 'Notification'),
                body: String(body || ''),
              },
              sound: 'default',
              badge: 1,
            },
          },
        };
      }

      const response = await admin.messaging().sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    console.log(`📊 FCM: ${totalSuccess} sent, ${totalFailure} failed.`);
    
    return { 
      success: totalSuccess > 0, 
      totalSuccess, 
      totalFailure 
    };
  } catch (error) {
    console.error('❌ Fatal error in sendFCMNotification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test notification
 */
export async function sendTestNotification(token, userId) {
  return await sendFCMNotification([token], 
    "Test Alarm 🚨", 
    "If this doesn't loop, check the TaskManager registration!",
    {
      type: "new_order",
      user_id: String(userId),
      timestamp: String(Date.now())
    }
  );
}