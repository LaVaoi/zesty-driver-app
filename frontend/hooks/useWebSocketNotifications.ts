import { useEffect, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// --- Types ---
interface WebSocketNotification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: any;
}

// --- Constants ---
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 30000; // 30 seconds

// Base URLs
// NOTE: These URLs should ideally be loaded from a secure config file or environment variables
const API_BASE_URL = 'https://ubua.cloud';
const WS_URL = 'wss://ubua.cloud';

export const useWebSocketNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveNotifications, setLiveNotifications] = useState<WebSocketNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // --- Refs for state and connection management ---
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0); // <-- CRITICAL: Tracks failed attempts for backoff
  const isConnectingRef = useRef(false); // <-- CRITICAL: Prevents simultaneous connection calls
  const userIdRef = useRef<string | null>(null);
  const userTypeRef = useRef<string | null>(null);

  /**
   * Calculates the exponential backoff delay time.
   * Delay = min(Initial * 2^attempt, Max)
   */
  const getReconnectDelay = useCallback((attempt: number): number => {
    return Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS
    );
  }, []);

  // Function to fetch unread count from API
  const fetchUnreadCount = useCallback(async () => {
    // ... (Your existing fetchUnreadCount logic remains here, unchanged)
    // The logic is sound, but it's simplified here for brevity.
    try {
      const token = await AsyncStorage.getItem('token');
      // ... (Rest of token and user type check)
      let userType = '';
      let userId = '';
      const clientData = await AsyncStorage.getItem('client');
      const deliveryManData = await AsyncStorage.getItem('deliveryMan');

      if (clientData) {
        userType = 'client';
        userId = JSON.parse(clientData).id.toString();
      } else if (deliveryManData) {
        userType = 'delivery_man';
        userId = JSON.parse(deliveryManData).id.toString();
      }

      if (!token || !userId) {
        console.log('❌ No token or user data for fetching unread count');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      } else {
        console.error('❌ Failed to fetch unread count:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
    }
  }, []);

  // Function to initiate WebSocket connection with robust error handling
  const connectWebSocket = useCallback(async () => {
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('⚠️ Connection already open or in progress. Skipping new connection attempt.');
      return;
    }

    isConnectingRef.current = true; // Set connecting flag

    try {
      // 1. Fetch User Data
      const clientData = await AsyncStorage.getItem('client');
      const deliveryManData = await AsyncStorage.getItem('deliveryMan');
      const token = await AsyncStorage.getItem('token');

      if (!token || (!clientData && !deliveryManData)) {
        console.log('❌ No token or user data found. Cannot connect WebSocket.');
        isConnectingRef.current = false;
        return;
      }

      let userType = clientData ? 'client' : 'delivery_man';
      let userId = clientData
        ? JSON.parse(clientData).id.toString()
        : JSON.parse(deliveryManData!).id.toString();

      userIdRef.current = userId;
      userTypeRef.current = userType;

      // 2. Cleanup old connection and reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        // Use clean close (1000) to ensure the previous onclose handler 
        // does NOT trigger another backoff loop.
        wsRef.current.close(1000, 'Client initiating fresh connection');
        wsRef.current = null;
      }

      console.log(`🔌 Connecting to WebSocket as ${userType} ${userId}...`);

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      // --- WebSocket Event Handlers ---

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        retryCountRef.current = 0; // CRITICAL: Reset the backoff counter on success
        isConnectingRef.current = false; // Reset connecting flag

        // Send subscription message
        ws.send(JSON.stringify({
          type: 'subscribe',
          userId: userId,
          userType: userType,
          token: token // Although token should ideally be passed in headers or query params, this respects your original structure.
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          // ... (Your existing onmessage logic for 'new_notification', 'unread_count_update', 'ping')
          if (data.type === 'new_notification') {
            const notification: WebSocketNotification = {
              id: data.data.id,
              title: data.data.title,
              message: data.data.message,
              is_read: data.data.is_read || false,
              created_at: data.data.created_at || new Date().toISOString(),
              data: data.data.data || {}
            };

            setLiveNotifications(prev => {
              const exists = prev.some(n => n.id === notification.id);
              if (!exists) {
                setUnreadCount(prevCount => prevCount + 1);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                return [notification, ...prev.slice(0, 49)];
              }
              return prev;
            });
          }
          if (data.type === 'unread_count_update') {
            setUnreadCount(data.count);
          }
          if (data.type === 'ping' && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
        isConnectingRef.current = false; // Reset connecting flag
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected: ${event.code} ${event.reason || 'No reason'}`);
        setIsConnected(false);
        isConnectingRef.current = false; // Reset connecting flag

        // --- Exponential Backoff Reconnection Logic ---
        if (event.code !== 1000 && retryCountRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = getReconnectDelay(retryCountRef.current);
          retryCountRef.current += 1;

          console.log(`🔄 Attempting to reconnect in ${delay / 1000}s. Attempt #${retryCountRef.current}...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (event.code !== 1000) {
          console.error('❌ Max reconnection attempts reached. Giving up until manual reconnect.');
          retryCountRef.current = 0; // Reset for next manual attempt
        }
      };

    } catch (error) {
      console.error('❌ Fatal error during WebSocket setup:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
      // Note: A severe error here should ideally be handled by reconnect logic if applicable.
    }
  }, [getReconnectDelay]);

  // --- Main Effect Hook ---
  useEffect(() => {
    // 1. Initial Connection: Connect immediately on mount
    // The internal guard in connectWebSocket prevents duplicates
    connectWebSocket();

    // 2. Initial Data Fetch
    fetchUnreadCount();

    // 3. Set up periodic unread count refresh
    const intervalId = setInterval(fetchUnreadCount, 30000);

    return () => {
      // 4. Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        // Use clean close (1000) to ensure the previous onclose handler 
        // does NOT trigger another backoff loop.
        wsRef.current.close(1000, 'Client initiating fresh connection');
        wsRef.current = null;
      }
      clearInterval(intervalId);
      // Reset retry count on final component teardown
      retryCountRef.current = 0;
    };
  }, [connectWebSocket, fetchUnreadCount]);

  // --- Utility functions (useCallback for stability) ---

  const handleNotificationRead = useCallback((notificationIds: number[]) => {
    setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    setLiveNotifications(prev =>
      prev.map(notif =>
        notificationIds.includes(notif.id)
          ? { ...notif, is_read: true }
          : notif
      )
    ); // NOTE: Removed the filter() to match the 'mark as read' intention rather than 'hide'.
  }, []);

  const clearLiveNotifications = useCallback(async () => {
    // ... (Your existing clearLiveNotifications logic remains here, ensuring the API call follows the UI update)
    const unreadIds = liveNotifications.filter(n => !n.is_read).map(n => n.id);
    handleNotificationRead(unreadIds);

    const token = await AsyncStorage.getItem('token');
    // ... (Authentication setup)
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ /* payload based on your backend */ })
      });
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
    }
  }, [liveNotifications, handleNotificationRead]); // Dependency on liveNotifications is necessary

  const markLiveNotificationAsRead = useCallback(async (notificationId: number) => {
    // ... (Your existing markLiveNotificationAsRead logic remains here)
    handleNotificationRead([notificationId]);

    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  }, [handleNotificationRead]);

  const sendNotificationReadReceipt = useCallback((notificationId: number) => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'notification_read',
          notificationId: notificationId
        }));
      } else {
        console.log('⚠️ WebSocket not connected, cannot send read receipt');
      }
    } catch (error) {
      console.error('❌ Error sending read receipt:', error);
    }
  }, []);

  return {
    unreadCount,
    liveNotifications,
    isConnected,
    clearLiveNotifications,
    markLiveNotificationAsRead,
    sendNotificationReadReceipt,
    handleNotificationRead,
    reconnectWebSocket: connectWebSocket,
    refreshUnreadCount: fetchUnreadCount,
    testConnection: useCallback(() => { /* ... test logic */ }, [])
  };
};