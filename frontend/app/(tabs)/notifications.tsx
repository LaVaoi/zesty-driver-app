import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { ListItemSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useDeliveryManNotifications } from '@/hooks/useDeliveryManNotifications';

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

// Memoized Notification Card Component
const NotificationCard = memo(({
  notification,
  isLiveNotification,
  onPress,
  getIconName,
  getIconColor,
  formatDate
}: {
  notification: Notification;
  isLiveNotification: boolean;
  onPress: () => void;
  getIconName: (type: string, status: string | null) => string;
  getIconColor: (type: string, status: string | null) => string;
  formatDate: (date: string) => string;
}) => {
  const isUnread = notification.is_read === 0;
  const iconColor = getIconColor(notification.type, notification.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.cardTouchable}
    >
      <View style={[
        styles.card,
        isUnread && styles.cardUnread,
        isLiveNotification && styles.cardLive
      ]}>
        {/* Left: Type Indicator Dot */}
        <View style={[styles.typeDot, { backgroundColor: iconColor }]} />

        {/* Center: Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.cardTime}>
              {formatDate(notification.created_at)}
            </Text>
          </View>

          <Text style={styles.cardMessage} numberOfLines={2}>
            {notification.message}
          </Text>

          {/* Order & Customer Info */}
          <View style={styles.cardMeta}>
            {notification.order_number && (
              <View style={styles.metaItem}>
                <Ionicons name="receipt-outline" size={14} color={Colors.primary} />
                <Text style={styles.metaText}>#{notification.order_number}</Text>
              </View>
            )}
            {notification.customer_name && (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={14} color={Colors.text.secondary} />
                <Text style={styles.metaText}>{notification.customer_name}</Text>
              </View>
            )}
            {isLiveNotification && (
              <View style={styles.liveChip}>
                <Text style={styles.liveChipText}>LIVE</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right: Unread Indicator & Chevron */}
        <View style={styles.cardRight}>
          {isUnread && <View style={styles.unreadDot} />}
          <Ionicons name="chevron-forward" size={20} color={Colors.gray[400]} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Skeleton Loader Component
const SkeletonLoader = () => (
  <View style={styles.skeletonContainer}>
    {[1, 2, 3, 4, 5].map((i) => (
      <View key={i} style={styles.skeletonCard}>
        <View style={styles.skeletonDot} />
        <View style={styles.skeletonContent}>
          <View style={styles.skeletonHeader}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonTime} />
          </View>
          <View style={styles.skeletonMessage} />
          <View style={styles.skeletonMeta} />
        </View>
      </View>
    ))}
  </View>
);

// Empty State Component
const EmptyState = ({ onRefresh }: { onRefresh: () => void }) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name="notifications-off-outline" size={48} color={Colors.primary} />
    </View>
    <Text style={styles.emptyTitle}>All caught up!</Text>
    <Text style={styles.emptyMessage}>
      No new notifications. We'll notify you when something arrives.
    </Text>
    <TouchableOpacity style={styles.emptyButton} onPress={onRefresh}>
      <Text style={styles.emptyButtonText}>Refresh</Text>
    </TouchableOpacity>
  </View>
);

// Error State Component
const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <View style={styles.errorContainer}>
    <View style={styles.errorIconContainer}>
      <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
    </View>
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>
      We couldn't load your notifications. Please try again.
    </Text>
    <TouchableOpacity style={styles.errorButton} onPress={onRetry}>
      <Text style={styles.errorButtonText}>Try Again</Text>
    </TouchableOpacity>
  </View>
);

const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();

  const {
    unreadCount: wsUnreadCount,
    liveNotifications,
    clearLiveNotifications,
    markLiveNotificationAsRead,
    handleNotificationRead,
    isConnected,
    reconnectWebSocket,
    refreshUnreadCount: refreshWsUnreadCount
  } = useDeliveryManNotifications();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiNotifications, setApiNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Merge WebSocket notifications with API notifications
  useEffect(() => {
    try {
      const combined = [...apiNotifications];

      liveNotifications.forEach(wsNotif => {
        const existingIndex = combined.findIndex(n => n.id === wsNotif.id);

        if (existingIndex >= 0) {
          combined[existingIndex] = {
            ...combined[existingIndex],
            is_read: wsNotif.is_read ? 1 : 0,
          };
        } else {
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

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(combined);
      setUnreadCount(combined.filter(n => n.is_read === 0).length);
      setError(null);
    } catch (err) {
      setError('Failed to process notifications');
    }
  }, [apiNotifications, liveNotifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
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
      } else {
        setError('Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchUnreadCountFromAPI = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      await fetch('https://ubua.cloud/api/delivery/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCountFromAPI();

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCountFromAPI]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
    fetchUnreadCountFromAPI();
    refreshWsUnreadCount();
  }, [fetchNotifications, fetchUnreadCountFromAPI, refreshWsUnreadCount]);

  const markAsRead = async (notificationId: number) => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: 1 }
            : n
        )
      );

      setUnreadCount(prev => Math.max(0, prev - 1));
      markLiveNotificationAsRead(notificationId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: 1 }))
      );

      setUnreadCount(0);
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
        case 'Preparing':
          return '#FF9500'; // Zesty Orange
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
        return Colors.primary; // Zesty Green
      case 'order_delivered':
        return Colors.success;
      case 'order_status_update':
        return '#2196F3';
      case 'new_order_available':
        return '#FF9500'; // Zesty Orange
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
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  }, []);

  const renderConnectionStatus = () => (
    <TouchableOpacity
      style={styles.connectionChip}
      onPress={!isConnected ? reconnectWebSocket : undefined}
      disabled={isConnected}
    >
      <View style={[styles.connectionDot, { backgroundColor: isConnected ? Colors.success : Colors.error }]} />
      <Text style={styles.connectionText}>
        {isConnected ? 'Live' : 'Offline'}
      </Text>
      {!isConnected && (
        <Ionicons name="refresh" size={14} color="#fff" style={styles.connectionIcon} />
      )}
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <LinearGradient
      colors={[Colors.dark, Colors.darkLight]}
      style={[styles.header, { paddingTop: insets.top + 10 }]}
    >
      <View style={styles.headerTop}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.headerSubtitle}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </Text>
            {renderConnectionStatus()}
          </View>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllAsRead}
            style={styles.markAllButton}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-done" size={20} color={Colors.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {renderHeader()}
        <SkeletonLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {renderHeader()}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            isLiveNotification={liveNotifications.some(n => n.id === item.id)}
            onPress={() => {
              if (item.is_read === 0) {
                markAsRead(item.id);
              }
            }}
            getIconName={getNotificationIcon}
            getIconColor={getNotificationColor}
            formatDate={formatDate}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          error ? (
            <ErrorState onRetry={fetchNotifications} />
          ) : (
            <EmptyState onRefresh={onRefresh} />
          )
        }
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  markAllText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  connectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 6,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  connectionIcon: {
    marginLeft: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  cardTouchable: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  cardUnread: {
    backgroundColor: '#F0FDF4', // Light green tint for unread
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  cardLive: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  typeDot: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 14,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  cardMessage: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 10,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginBottom: 8,
  },
  liveChip: {
    backgroundColor: `${Colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  liveChipText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  skeletonContainer: {
    padding: 16,
    gap: 12,
  },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  skeletonDot: {
    width: 4,
    height: '100%',
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginRight: 14,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '60%',
    height: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  skeletonTime: {
    width: 40,
    height: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  skeletonMessage: {
    width: '90%',
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonMeta: {
    width: '50%',
    height: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${Colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 250,
    marginBottom: 24,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${Colors.error}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 250,
    marginBottom: 24,
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NotificationsScreen;