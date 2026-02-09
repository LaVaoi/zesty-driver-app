import { useDeliveryManWebSocketNotifications } from './useDeliveryManWebSocketNotifications';

// Simple wrapper for compatibility
export const useDeliveryManNotifications = () => {
  const { 
    unreadCount, 
    liveNotifications,
    isConnected,
    clearLiveNotifications,
    markLiveNotificationAsRead,
    handleNotificationRead,
    reconnectWebSocket,
    refreshUnreadCount,
  } = useDeliveryManWebSocketNotifications();
  
  return { 
    unreadCount,
    liveNotifications,
    isConnected,
    clearLiveNotifications,
    markLiveNotificationAsRead,
    handleNotificationRead,
    reconnectWebSocket,
    refreshUnreadCount,
  };
};
