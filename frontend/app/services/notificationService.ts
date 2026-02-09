import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Dynamic import for expo-notifications
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  // Configure notification handler
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (error) {
  console.log('expo-notifications not available');
}

let soundObject: Audio.Sound | null = null;

// Initialize notification service
export const initializeNotifications = async () => {
  try {
    if (!Notifications) {
      console.log('Notifications not available, using local notifications only');
      return true; // Return true to continue with local notifications
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Load notification sound (optional - will use system sound if not available)
    try {
      // Try to load custom sound, but don't fail if it doesn't exist
      // const { sound } = await Audio.Sound.createAsync(
      //   require('@/assets/sounds/notification.mp3'),
      //   { shouldPlay: false }
      // );
      // soundObject = sound;
    } catch (error) {
      console.log('Using system notification sound');
      // Continue without custom sound - will use system sound
    }

    return true;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return false;
  }
};

// Play notification sound
export const playNotificationSound = async () => {
  try {
    if (soundObject) {
      await soundObject.replayAsync();
    } else {
      // Fallback: Use system sound
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  } catch (error) {
    console.error('Error playing notification sound:', error);
    // Fallback to haptics
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

// Schedule a local notification
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  data?: any
) => {
  try {
    if (Notifications) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: true,
          priority: Notifications.AndroidNotificationPriority?.HIGH || 'high',
        },
        trigger: null, // Show immediately
      });
    }

    // Play sound
    await playNotificationSound();

    // Haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    // Fallback: just play sound and haptic
    await playNotificationSound();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

// Get push notification token
export const getPushToken = async (): Promise<string | null> => {
  try {
    if (!Notifications) {
      console.log('Notifications module not available');
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync();
    console.log('Push token obtained:', token.data);
    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
};

// Register push token with backend
export const registerPushToken = async (token: string) => {
  try {
    const deliveryManToken = await AsyncStorage.getItem('deliveryManToken');
    if (!deliveryManToken) {
      console.log('No delivery man token found, cannot register push token');
      return;
    }

    console.log('Registering push token with backend...');
    const response = await fetch('https://ubua.cloud/api/delivery/register-push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deliveryManToken}`,
      },
      body: JSON.stringify({ push_token: token }),
    });

    if (response.ok) {
      console.log('Push token registered successfully');
    } else {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Failed to register push token:', errorData.message);
    }
  } catch (error) {
    console.error('Error registering push token:', error);
  }
};

// Cleanup
export const cleanupNotifications = async () => {
  try {
    if (soundObject) {
      await soundObject.unloadAsync();
      soundObject = null;
    }
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
  }
};

