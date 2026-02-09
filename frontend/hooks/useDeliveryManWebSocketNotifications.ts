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
const WS_CLEAN_CLOSE_CODE = 1000; // Standard code for Normal Closure

// NOTE: These URLs should ideally be loaded from a secure config file or environment variables
const API_BASE_URL = 'https://ubua.cloud';
const WS_URL = 'wss://ubua.cloud';

export const useDeliveryManWebSocketNotifications = () => {
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

  // --- Utility function to handle UI update for notification read ---
  const handleNotificationRead = useCallback((notificationIds: number[]) => {
    // Decrease unread count
    setUnreadCount(prev => Math.max(0, prev - notificationIds.length));

    // Mark as read in the live list (Deliveryman usually keeps the list)
    setLiveNotifications(prev =>
      prev.map(notif =>
        notificationIds.includes(notif.id)
          ? { ...notif, is_read: true }
          : notif
      )
    );
  }, []);

  // Function to fetch unread count from API
  const fetchUnreadCount = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      const deliveryManData = await AsyncStorage.getItem('deliveryMan');

      if (!token || !deliveryManData) {
        console.log('❌ Auth data missing for deliveryman unread count fetch.');
        return;
      }

      const endpoint = `${API_BASE_URL}/api/delivery/notifications/unread-count`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.unreadCount || data.count || 0;
        setUnreadCount(count);
        console.log('✅ Deliveryman unread count:', count);
      } else {
        console.error('❌ Failed to fetch deliveryman unread count:', response.status);
      }
    } catch (error) {
      console.error('❌ Error fetching deliveryman unread count:', error);
    }
  }, []);

  // Function to initiate WebSocket connection with robust error handling
  const connectWebSocket = useCallback(async () => {
    // Guard 1: Prevent concurrent connections
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('⚠️ Connection already open or in progress. Skipping new connection attempt.');
      return;
    }

    isConnectingRef.current = true; // Set connecting flag

    try {
      // 1. Fetch User Data
      const deliveryManData = await AsyncStorage.getItem('deliveryMan');
      const token = await AsyncStorage.getItem('deliveryManToken');

      if (!deliveryManData || !token) {
        console.log('❌ No deliveryman data or token found. Cannot connect WebSocket.');
        isConnectingRef.current = false;
        return;
      }

      const deliveryMan = JSON.parse(deliveryManData);
      const userType = 'delivery_man';
      const userId = deliveryMan.id.toString();

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

      console.log(`🔌 Connecting WebSocket as ${userType} ${userId}...`);

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
          token: token
        }));
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

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
                if (!notification.is_read) {
                  setUnreadCount(prevCount => prevCount + 1);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                return [notification, ...prev.slice(0, 49)];
              }
              return prev;
            });
          }

          if (data.type === 'unread_count_update') {
            setUnreadCount(data.count || 0);
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
        isConnectingRef.current = false;
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected: ${event.code} ${event.reason || 'No reason'}`);
        setIsConnected(false);
        isConnectingRef.current = false;

        // --- Exponential Backoff Reconnection Logic ---
        // Only attempt reconnect if not a clean closure and within retry limits
        if (event.code !== WS_CLEAN_CLOSE_CODE && retryCountRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = getReconnectDelay(retryCountRef.current);
          retryCountRef.current += 1; // Increment attempt count

          console.log(`🔄 Attempting to reconnect in ${delay / 1000}s. Attempt #${retryCountRef.current}...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (event.code !== WS_CLEAN_CLOSE_CODE) {
          console.error('❌ Max reconnection attempts reached. Giving up.');
          retryCountRef.current = 0; // Reset for next manual attempt
        }
      };
      // --- End WebSocket Event Handlers ---

    } catch (error) {
      console.error('❌ Fatal error during WebSocket setup:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
      // Note: No exponential backoff here, as the error is typically a setup failure.
    }
  }, [getReconnectDelay]);

  // --- Main Effect Hook ---
  useEffect(() => {
    // 1. Initial Connection
    connectWebSocket();

    // 2. Initial Data Fetch
    fetchUnreadCount();

    // 3. Set up periodic unread count refresh
    const intervalId = setInterval(fetchUnreadCount, 30000);

    return () => {
      // 4. Cleanup on unmount
      if (wsRef.current) {
        // Use clean close code to prevent reconnect logic from firing
        wsRef.current.close(WS_CLEAN_CLOSE_CODE, 'Component unmounting');
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      clearInterval(intervalId);
      retryCountRef.current = 0;
    };
  }, [connectWebSocket, fetchUnreadCount]);

  // --- API/Helper Functions (using useCallback) ---

  const clearLiveNotifications = useCallback(async () => {
    // Immediately update UI
    setLiveNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
    setUnreadCount(0);

    const token = await AsyncStorage.getItem('deliveryManToken');
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/api/delivery/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
    } catch (error) {
      console.error('❌ Error calling mark-all-read API:', error);
      // OPTIONAL: Revert UI state if API fails
    }
  }, []);

  const markLiveNotificationAsRead = useCallback(async (notificationId: number) => {
    // Immediately update UI
    handleNotificationRead([notificationId]);

    const token = await AsyncStorage.getItem('deliveryManToken');
    if (!token) return;

    try {
      await fetch(`${API_BASE_URL}/api/delivery/notifications/mark-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_id: notificationId })
      });
    } catch (error) {
      console.error('❌ Error calling mark-read API:', error);
      // OPTIONAL: Revert UI state if API fails
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

  const testConnection = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'test',
        message: 'Test message from deliveryman'
      }));
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
    testConnection,
  };
};
