// utils/fcmService.js
import admin from 'firebase-admin';

let isInitialized = false;

try {
  // Check if env variable exists
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON not found in .env file');
  }

  // Parse the service account from the environment variable
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  
  // CRITICAL: Replace escaped newlines with actual newlines
  // Handle both \\n (double backslash) and \n (single backslash)
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key
      .replace(/\\\\n/g, '\n')  // First replace \\n with \n
      .replace(/\\n/g, '\n');    // Then replace \n with actual newlines
  }

  // Initialize Firebase Admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
    console.log(`   Project: ${serviceAccount.project_id}`);
  } else {
    isInitialized = true;
    console.log('✅ Firebase Admin SDK already initialized');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin SDK:');
  console.error('   Error:', error.message);
  if (error.message.includes('JSON')) {
    console.error('   Hint: Check your FIREBASE_SERVICE_ACCOUNT_JSON formatting in .env');
  }
  isInitialized = false;
}

/**
 * Send FCM push notifications to multiple devices
 * @param {string[]} tokens - Array of FCM device tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body/message
 * @param {object} data - Optional data payload
 */
export async function sendFCMNotification(tokens, title, body, data = {}) {
  // Check if Firebase is initialized
  if (!isInitialized) {
    console.error('❌ Firebase Admin SDK is not initialized. Cannot send FCM notification.');
    return { success: false, error: 'Firebase not initialized' };
  }

  // Validate inputs
  if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
    console.log('⚠️ No tokens provided for FCM notification');
    return { success: false, error: 'No tokens provided' };
  }

  // Ensure tokens is an array
  const tokenArray = Array.isArray(tokens) ? tokens : [tokens];
  
  // Filter out empty/invalid tokens
  const validTokens = tokenArray.filter(token => token && typeof token === 'string' && token.trim().length > 0);
  
  if (validTokens.length === 0) {
    console.log('⚠️ No valid tokens found for FCM notification');
    return { success: false, error: 'No valid tokens' };
  }

  console.log(`📤 Sending FCM notification to ${validTokens.length} device(s)...`);
  console.log(`   Title: ${title}`);
  console.log(`   Body: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`);

  try {
    const BATCH_SIZE = 500; // Firebase allows max 500 tokens per batch
    const results = [];
    let totalSuccess = 0;
    let totalFailure = 0;

    // Process tokens in batches
    for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
      const batchTokens = validTokens.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      try {
        // Prepare message payload - FIXED VERSION
        const message = {
          tokens: batchTokens,
          notification: { 
            title: String(title || 'Notification'), 
            body: String(body || '')
          },
          data: data ? Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {}) : {},
          // Android specific options
          android: {
            priority: 'high', // Critical for popup
            notification: {
              sound: 'default', 
              // MATCH THIS TO YOUR app.json -> "id": "new-order-alert"
              channelId: 'new-order-alert', 
              priority: 'max',      // Required for "Heads-up" display
              clickAction: 'OPEN_APP'
            }
          },
          // iOS specific options
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                alert: {
                  title: String(title || 'Notification'),
                  body: String(body || '')
                }
              }
            },
            headers: {
              'apns-priority': '10' 
            }
          }
        };
        
        // Send via Firebase Cloud Messaging
        const response = await admin.messaging().sendEachForMulticast(message);
        
        results.push(response);
        totalSuccess += response.successCount;
        totalFailure += response.failureCount;
        
        console.log(`✅ Batch ${batchNumber}: ${response.successCount} sent, ${response.failureCount} failed`);
        
        // Log failed tokens for debugging
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const tokenPreview = batchTokens[idx].substring(0, 20);
              console.error(`   ❌ Token [${tokenPreview}...]: ${resp.error?.code} - ${resp.error?.message}`);
              
              // Auto-remove invalid tokens
              if (resp.error?.code === 'messaging/invalid-registration-token' || 
                  resp.error?.code === 'messaging/registration-token-not-registered') {
                console.log(`   🗑️ Auto-removing invalid token: ${tokenPreview}...`);
              }
            }
          });
        }
      } catch (batchError) {
        console.error(`❌ Error sending batch ${batchNumber}:`, batchError.message);
        totalFailure += batchTokens.length;
      }
    }

    const summary = `📊 FCM Complete: ${totalSuccess} sent, ${totalFailure} failed (${validTokens.length} total)`;
    console.log(summary);
    
    return { 
      success: totalSuccess > 0, 
      results,
      totalSuccess,
      totalFailure,
      totalTokens: validTokens.length
    };
  } catch (error) {
    console.error('❌ Fatal error in sendFCMNotification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send a test notification to verify delivery
 */
export async function sendTestNotification(token, userId) {
  return await sendFCMNotification([token], 
    "Test Notification", 
    "This should show in both foreground and background!",
    {
      test_type: "delivery_test",
      user_id: String(userId),
      timestamp: String(Date.now())
    }
  );
}