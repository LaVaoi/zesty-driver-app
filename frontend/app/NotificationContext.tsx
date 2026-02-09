// app/(delivery)/notifications.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Colors from '@/constants/Colors';
import { router } from 'expo-router';
import { useWebSocketNotifications } from '../hooks/useWebSocketNotifications';

interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: {
    order_id?: number;
    order_number?: string;
    type?: string;
    [key: string]: any;
  };
}

export default function DeliveryManNotificationsScreen() {
  const [dbNotifications, setDbNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryManName, setDeliveryManName] = useState('');
  const insets = useSafeAreaInsets();

  // Use the SAME WebSocket hook - it already handles delivery men
  const {
    liveNotifications,
    isConnected,
    clearLiveNotifications,
    reconnectWebSocket,
    handleNotificationRead,
    markLiveNotificationAsRead
  } = useWebSocketNotifications();

  // Combine database notifications with live WebSocket notifications
  const allNotifications = [...liveNotifications, ...dbNotifications];
  const totalUnreadCount = allNotifications.filter(n => !n.is_read).length;

  const fetchDeliveryManInfo = useCallback(async () => {
    try {
      const deliveryManData = await AsyncStorage.getItem('deliveryMan');
      if (deliveryManData) {
        const deliveryMan = JSON.parse(deliveryManData);
        setDeliveryManName(deliveryMan.name || 'Delivery Partner');
      }
    } catch (error) {
      console.error('Error fetching delivery man info:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await axios.get(
        'https://ubua.cloud/api/notifications',
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setDbNotifications(response.data.notifications);
      }
    } catch (error: any) {
      console.error('❌ Error fetching notifications:', error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = async (notificationId: number, isLiveNotification = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      // Immediate UI update for live notifications
      if (isLiveNotification) {
        handleNotificationRead([notificationId]);
      } else {
        // Update DB notifications state
        setDbNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, is_read: true } : notif
          )
        );
      }

      // Send to backend (only for DB notifications)
      if (!isLiveNotification) {
        await axios.post(
          'https://ubua.cloud/api/notifications/mark-read',
          {
            notification_id: notificationId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      }

      // If notification is about an order, navigate to order details
      const notification = allNotifications.find(n => n.id === notificationId);
      if (notification?.data?.order_id && notification?.data?.type === 'new_order_assigned') {
        // Navigate to order details or delivery screen
        // Order detail navigation - handled within tabs
      }

    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      // Get all unread IDs for immediate UI update
      const unreadIds = allNotifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      // Immediate UI update
      handleNotificationRead(unreadIds);

      // Mark DB notifications as read
      setDbNotifications(prev =>
        prev.map(notif => ({ ...notif, is_read: true }))
      );

      // Send to backend
      await axios.post(
        'https://ubua.cloud/api/notifications/mark-all-read',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(), fetchDeliveryManInfo()]);
    setRefreshing(false);
  };

  const getNotificationIcon = (notification: Notification) => {
    const type = notification.data?.type;

    switch (type) {
      case 'new_order_assigned':
        return { icon: 'bag-handle', color: Colors.primary };
      case 'order_update':
        return { icon: 'refresh', color: Colors.warning };
      case 'urgent':
        return { icon: 'flash', color: Colors.warning };
      case 'system':
        return { icon: 'settings', color: Colors.gray[500] };
      case 'earnings':
        return { icon: 'cash', color: Colors.success };
      default:
        return { icon: 'notifications', color: Colors.gray[400] };
    }
  };

  const getNotificationPriority = (notification: Notification) => {
    const type = notification.data?.type;
    if (type === 'new_order_assigned' || type === 'urgent') {
      return 'high';
    }
    if (type === 'order_update') {
      return 'medium';
    }
    return 'low';
  };

  useEffect(() => {
    fetchDeliveryManInfo();
    fetchNotifications();
  }, [fetchNotifications, fetchDeliveryManInfo]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with delivery man info */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Hello, {deliveryManName}</Text>
          <Text style={styles.title}>Your Notifications</Text>
        </View>
        <View style={styles.headerRight}>
          {liveNotifications.length > 0 && !isConnected && (
            <TouchableOpacity
              style={styles.reconnectButton}
              onPress={reconnectWebSocket}
            >
              <Ionicons name="refresh" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
          {totalUnreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={styles.markAllReadText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Connection status indicator */}
      {!isConnected && (
        <View style={styles.connectionStatus}>
          <Ionicons name="wifi-outline" size={16} color={Colors.warning} />
          <Text style={styles.connectionStatusText}>Reconnecting...</Text>
          <TouchableOpacity onPress={reconnectWebSocket}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Live notifications section */}
        {liveNotifications.length > 0 && (
          <View style={styles.liveSection}>
            <View style={styles.liveHeader}>
              <View style={styles.liveIndicator}>
                <Ionicons name="radio" size={12} color={Colors.success} />
                <Text style={styles.liveIndicatorText}>LIVE</Text>
              </View>
              <Text style={styles.liveHeaderText}>Real-time Updates</Text>
            </View>
            {liveNotifications.map(notification => {
              const priority = getNotificationPriority(notification);
              const iconInfo = getNotificationIcon(notification);

              return (
                <TouchableOpacity
                  key={`live-${notification.id}`}
                  style={[
                    styles.notificationCard,
                    styles.liveNotificationCard,
                    priority === 'high' && styles.highPriorityCard,
                    priority === 'medium' && styles.mediumPriorityCard,
                  ]}
                  onPress={() => {
                    handleNotificationRead([notification.id]);
                    markLiveNotificationAsRead(notification.id);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationIconContainer}>
                      <View style={[styles.notificationIcon, { backgroundColor: `${iconInfo.color}20` }]}>
                        <Ionicons name={iconInfo.icon as any} size={20} color={iconInfo.color} />
                      </View>
                      <View>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        <View style={styles.priorityBadge}>
                          <Ionicons name="flash" size={10} color={Colors.warning} />
                          <Text style={styles.priorityText}>Live</Text>
                        </View>
                      </View>
                    </View>
                    {!notification.is_read && <View style={styles.unreadIndicator} />}
                  </View>

                  <Text style={styles.notificationMessage}>{notification.message}</Text>

                  {notification.data?.order_number && (
                    <View style={styles.orderInfo}>
                      <Ionicons name="document-text" size={14} color={Colors.text.secondary} />
                      <Text style={styles.orderNumber}>Order #{notification.data.order_number}</Text>
                    </View>
                  )}

                  <Text style={styles.notificationTime}>
                    Just now • {priority === 'high' ? 'High priority' : 'Standard'}
                  </Text>

                  {notification.data?.type === 'new_order_assigned' && (
                    <TouchableOpacity
                      style={styles.viewOrderButton}
                      onPress={() => {
                        handleNotificationRead([notification.id]);
                        markLiveNotificationAsRead(notification.id);
                        if (notification.data?.order_id) {
                          // Order detail navigation - handled within tabs
                        }
                      }}
                    >
                      <Text style={styles.viewOrderButtonText}>View Order Details</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* All notifications */}
        <View style={styles.allNotificationsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Notifications</Text>
            <Text style={styles.notificationCount}>{allNotifications.length} total</Text>
          </View>

          {allNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={60} color={Colors.gray[400]} />
              <Text style={styles.emptyStateText}>No notifications yet</Text>
              <Text style={styles.emptyStateSubtext}>
                You'll see order assignments and updates here
              </Text>
            </View>
          ) : (
            allNotifications.map((notification, index) => {
              const isLive = notification.id >= 1000000; // Assuming live notifications have high IDs
              const iconInfo = getNotificationIcon(notification);

              return (
                <TouchableOpacity
                  key={notification.id || index}
                  style={[
                    styles.notificationCard,
                    !notification.is_read && styles.unreadNotification,
                  ]}
                  onPress={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id, isLive);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.notificationHeader}>
                    <View style={styles.notificationIconContainer}>
                      <View style={[styles.notificationIcon, { backgroundColor: `${iconInfo.color}20` }]}>
                        <Ionicons name={iconInfo.icon as any} size={20} color={iconInfo.color} />
                      </View>
                      <View>
                        <Text style={styles.notificationTitle}>{notification.title}</Text>
                        {isLive && (
                          <View style={styles.liveBadge}>
                            <Ionicons name="flash" size={8} color={Colors.success} />
                            <Text style={styles.liveBadgeText}>Live</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {!notification.is_read && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.notificationMessage}>{notification.message}</Text>

                  {notification.data?.order_number && (
                    <View style={styles.orderInfo}>
                      <Ionicons name="document-text" size={14} color={Colors.text.secondary} />
                      <Text style={styles.orderNumber}>Order #{notification.data.order_number}</Text>
                    </View>
                  )}

                  <Text style={styles.notificationTime}>
                    {new Date(notification.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>

                  {notification.data?.type === 'new_order_assigned' && !notification.is_read && (
                    <TouchableOpacity
                      style={styles.viewOrderButton}
                      onPress={() => {
                        markAsRead(notification.id, isLive);
                        if (notification.data?.order_id) {
                          // Order detail navigation - handled within tabs
                        }
                      }}
                    >
                      <Text style={styles.viewOrderButtonText}>Accept Order</Text>
                      <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllReadText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  reconnectButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.warning + '10',
    borderBottomWidth: 1,
    borderBottomColor: Colors.warning + '20',
  },
  connectionStatusText: {
    fontSize: 12,
    color: Colors.warning,
    flex: 1,
  },
  retryText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  liveSection: {
    marginBottom: 24,
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
    letterSpacing: 0.5,
  },
  liveHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  liveNotificationCard: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
    backgroundColor: Colors.success + '08',
  },
  highPriorityCard: {
    borderLeftColor: Colors.error,
    backgroundColor: Colors.error + '08',
  },
  mediumPriorityCard: {
    borderLeftColor: Colors.warning,
    backgroundColor: Colors.warning + '08',
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  unreadNotification: {
    backgroundColor: Colors.primary + '08',
    borderColor: Colors.primary + '30',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  notificationIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warning + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warning,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    padding: 8,
    backgroundColor: Colors.gray[50],
    borderRadius: 8,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.text.light,
    marginBottom: 12,
  },
  viewOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  viewOrderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  allNotificationsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  notificationCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});