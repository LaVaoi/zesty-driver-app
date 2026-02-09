import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import axios from 'axios';

// Configure notifications globally
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(userType: string, userId: string | number) {
  let token;

  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('new-order-alert', {
      name: 'New Order Alert',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'newOrderAlert.mp3',
    });
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    token = tokenData.data;

    console.log('📱 Device Push Token Type:', tokenData.type);
    console.log('📱 Push token:', token);

    const payload = {
      userType: userType,
      userId: userId,
      token: token,
      platform: Platform.OS
    };

    console.log('📤 Sending to backend:', JSON.stringify(payload, null, 2));

    const response = await axios.post(
      'https://ubua.cloud/api/notifications/register-token',
      payload
    );

    console.log('✅ Token registered successfully:', response.data);

  } catch (err: any) {
    console.error('❌ Push registration error:', err.message);

    if (err.response) {
      console.error('   Status:', err.response.status);
      console.error('   Error data:', JSON.stringify(err.response.data, null, 2));
    } else if (err.request) {
      console.error('   No response received from server');
    } else {
      console.error('   Error details:', err);
    }
  }

  return token;
}
