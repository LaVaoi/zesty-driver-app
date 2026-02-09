import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { ListItemSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useDeliveryManNotifications } from '@/hooks/useDeliveryManNotifications'; // ✅ Changed to deliveryman hook

interface Notification {
  id: number;
  order_id: number | null;
  type: string;
  title: string;
  message: string;
  is_read: number;
  created_at: string;
  order_number: string | null;
  status: string | null;
  customer_name: string | null;
}

const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  // Use the DeliveryMan WebSocket hook
  const {
    unreadCount: wsUnreadCount,
    liveNotifications,
    clearLiveNotifications,
    markLiveNotificationAsRead,
    handleNotificationRead,
    isConnected,
    reconnectWebSocket,
    refreshUnreadCount: refreshWsUnreadCount
  } = useDeliveryManNotifications(); // ✅ Changed to deliveryman hook

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiNotifications, setApiNotifications] = useState<Notification[]>([]);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Merge WebSocket notifications with API notifications
  useEffect(() => {
    // Combine both sources, remove duplicates by ID
    const combined = [...apiNotifications];

    liveNotifications.forEach(wsNotif => {
      // Check if exists in apiNotifications
      const existingIndex = combined.findIndex(n => n.id === wsNotif.id);

      if (existingIndex >= 0) {
        // Update existing notification with WebSocket data
        combined[existingIndex] = {
          ...combined[existingIndex],
          is_read: wsNotif.is_read ? 1 : 0, // Keep the read status from WebSocket
          // You might want to update other fields too
        };
      } else {
        // Add new WebSocket notification
        combined.push({
          id: wsNotif.id,
          order_id: wsNotif.data?.order_id || null,
          type: wsNotif.data?.type || 'general',
          title: wsNotif.title,
          message: wsNotif.message,
          is_read: wsNotif.is_read ? 1 : 0,
          created_at: wsNotif.created_at,
          order_number: wsNotif.data?.order_number || null,
          status: wsNotif.data?.status || null,
          customer_name: wsNotif.data?.customer_name || null
        });
      }
    });

    // Sort by date (newest first)
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setNotifications(combined);

    // Calculate unread count from combined notifications
    const unread = combined.filter(n => n.is_read === 0).length;
    setUnreadCount(unread);

    console.log(`📊 Total notifications: ${combined.length}, Unread: ${unread}`);
  }, [apiNotifications, liveNotifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      const response = await fetch('https://ubua.cloud/api/delivery/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setApiNotifications(data.notifications || []);
      } else if (response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.removeItem('deliveryManToken');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (!refreshing) {
        Alert.alert('Error', 'Failed to fetch notifications');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const fetchUnreadCountFromAPI = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      const response = await fetch('https://ubua.cloud/api/delivery/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // We'll use the combined count instead
        // setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCountFromAPI();

    // Set up periodic refresh for API notifications
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCountFromAPI]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
    fetchUnreadCountFromAPI();
    refreshWsUnreadCount(); // Also refresh WebSocket unread count
  }, [fetchNotifications, fetchUnreadCountFromAPI, refreshWsUnreadCount]);

  const markAsRead = async (notificationId: number) => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      // Update UI immediately - mark as read but keep in list
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: 1 }
            : n
        )
      );

      // Also update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Use WebSocket function to mark as read
      markLiveNotificationAsRead(notificationId);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Replace the markAllAsRead function with:
  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Mark all as read in UI but keep in list
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: 1 }))
      );

      // Reset unread count
      setUnreadCount(0);

      // Use WebSocket clear function
      clearLiveNotifications();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read');
    }
  };


  const getNotificationIcon = useCallback((type: string, status: string | null) => {
    if (status) {
      switch (status) {
        case 'Pending':
          return 'time-outline';
        case 'Preparing':
          return 'restaurant-outline';
        case 'OutForDelivery':
          return 'bicycle-outline';
        case 'Delivered':
          return 'checkmark-circle-outline';
        default:
          return 'notifications-outline';
      }
    }

    switch (type) {
      case 'order_assigned':
        return 'bag-add-outline';
      case 'order_delivered':
        return 'checkmark-circle';
      case 'order_status_update':
        return 'refresh-outline';
      case 'new_order_available':
        return 'add-circle';
      default:
        return 'notifications-outline';
    }
  }, []);

  const getNotificationColor = useCallback((type: string, status: string | null) => {
    if (status) {
      switch (status) {
        case 'Pending':
          return '#FF9500';
        case 'Preparing':
          return '#FF9500';
        case 'OutForDelivery':
          return '#2196F3';
        case 'Delivered':
          return Colors.success;
        default:
          return Colors.text.secondary;
      }
    }

    switch (type) {
      case 'order_assigned':
        return Colors.primary;
      case 'order_delivered':
        return Colors.success;
      case 'order_status_update':
        return '#2196F3';
      case 'new_order_available':
        return '#FF9500';
      default:
        return Colors.text.secondary;
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }, []);

  const renderSkeleton = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {[1, 2, 3, 4, 5].map((item) => (
        <ListItemSkeleton key={item} />
      ))}
    </ScrollView>
  );

  // Connection status indicator
  const renderConnectionStatus = () => (
    <View style={styles.connectionStatus}>
      <View
        style={[
          styles.connectionDot,
          { backgroundColor: isConnected ? Colors.success : Colors.error }
        ]}
      />
      <Text style={styles.connectionText}>
        {isConnected ? 'Live' : 'Connecting...'}
      </Text>
      {!isConnected && (
        <TouchableOpacity onPress={reconnectWebSocket}>
          <Text style={styles.reconnectText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading && notifications.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[Colors.dark, Colors.darkLight]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
            <Ionicons name="notifications" size={32} color="#fff" />
          </View>
        </LinearGradient>
        {renderSkeleton()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[Colors.dark, Colors.darkLight]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </Text>
            {renderConnectionStatus()}
          </View>
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={markAllAsRead}
                style={styles.markAllButton}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark-done" size={20} color="#fff" />
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            <View style={styles.notificationIconContainer}>
              <Ionicons name="notifications" size={32} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={Colors.gray[400]} />
            <Text style={styles.emptyStateText}>No notifications</Text>
            <Text style={styles.emptyStateSubtext}>
              You'll see order updates and important messages here
            </Text>
          </View>
        ) : (
          notifications.map((notification) => {
            const isUnread = notification.is_read === 0;
            const iconColor = getNotificationColor(notification.type, notification.status);
            const isLiveNotification = liveNotifications.some(n => n.id === notification.id);

            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  isUnread && styles.notificationCardUnread,
                  isLiveNotification && styles.liveNotification,
                ]}
                onPress={() => {
                  if (isUnread) {
                    markAsRead(notification.id);
                  }
                  // Don't navigate away or remove the notification
                  // Keep it visible like client system
                }}
                activeOpacity={0.7}
              >
                <View style={styles.notificationHeader}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: `${iconColor}20` },
                    ]}
                  >
                    <Ionicons
                      name={getNotificationIcon(notification.type, notification.status) as any}
                      size={24}
                      color={iconColor}
                    />
                    {isLiveNotification && (
                      <View style={styles.liveIndicator} />
                    )}
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={styles.notificationTitleRow}>
                      <Text style={styles.notificationTitle}>
                        {notification.title}
                      </Text>
                      {isUnread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notificationMessage}>
                      {notification.message}
                    </Text>
                    {notification.order_number && (
                      <Text style={styles.notificationOrder}>
                        Order #{notification.order_number}
                      </Text>
                    )}
                    {notification.customer_name && (
                      <Text style={styles.notificationCustomer}>
                        Customer: {notification.customer_name}
                      </Text>
                    )}
                    <View style={styles.notificationFooter}>
                      <Text style={styles.notificationTime}>
                        {formatDate(notification.created_at)}
                      </Text>
                      {isLiveNotification && (
                        <View style={styles.liveBadge}>
                          <Text style={styles.liveBadgeText}>Live</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationIconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  markAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  reconnectText: {
    fontSize: 11,
    color: '#FFD700',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  notificationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  notificationCardUnread: {
    borderLeftColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  liveNotification: {
    borderWidth: 1,
    borderColor: `${Colors.primary}33`,
  },
  notificationHeader: {
    flexDirection: 'row',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  liveIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationOrder: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  notificationCustomer: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  liveBadge: {
    backgroundColor: `${Colors.primary}1A`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
});

export default NotificationsScreen;