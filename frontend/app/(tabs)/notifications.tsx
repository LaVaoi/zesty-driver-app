// app/(tabs)/notifications.tsx
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/Colors';
import { useDeliveryManNotifications } from '@/hooks/useDeliveryManNotifications';
import { useLanguage } from '@/constants/contexts/LanguageContext';

// ─────────────────────────────────────────────
// Design Tokens  (unchanged)
// ─────────────────────────────────────────────
const C = {
  bg:            '#0D0F12',
  bgCard:        '#161A20',
  bgCardAlt:     '#1C2128',
  bgCardUnread:  '#161E1A',
  accent:        '#39E97B',
  accentDim:     '#39E97B14',
  accentBorder:  '#39E97B44',
  accentGlow:    '#39E97B',
  white:         '#FFFFFF',
  g1:            '#E8EAED',
  g2:            '#9CA3AF',
  g3:            '#4B5563',
  g4:            '#2D3340',
  sep:           '#1F2937',
  headerTop:     '#0A0C0F',
  headerBot:     '#161A20',
  danger:        '#EF4444',
  dangerDim:     '#EF444418',
  blue:          '#60A5FA',
  blueDim:       '#60A5FA18',
  amber:         '#F59E0B',
  amberDim:      '#F59E0B18',
  success:       '#39E97B',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
const R  = { sm: 8, md: 12, lg: 16, xl: 20, round: 999 };

const CARD_SHADOW = Platform.select({
  ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12 },
  android: { elevation: 6 },
});
const LIVE_GLOW = Platform.select({
  ios:     { shadowColor: '#39E97B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
  android: { elevation: 8 },
});

// ─────────────────────────────────────────────
// Interfaces  (unchanged)
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// NotificationCard
// ─────────────────────────────────────────────
const NotificationCard = memo(({
  notification,
  isLiveNotification,
  onPress,
  getIconName,
  getIconColor,
  formatDate,
  liveChipLabel,
}: {
  notification: Notification;
  isLiveNotification: boolean;
  onPress: () => void;
  getIconName: (type: string, status: string | null) => string;
  getIconColor: (type: string, status: string | null) => string;
  formatDate: (date: string) => string;
  liveChipLabel: string;
}) => {
  const isUnread   = notification.is_read === 0;
  const iconColor  = getIconColor(notification.type, notification.status);
  const iconName   = getIconName(notification.type, notification.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={sc.touchable}
    >
      <View style={[
        sc.card,
        CARD_SHADOW,
        isUnread        && sc.cardUnread,
        isLiveNotification && LIVE_GLOW,
      ]}>
        {/* Left accent rail */}
        <View style={[sc.rail, { backgroundColor: isUnread ? iconColor : C.g4 }]} />

        {/* Icon badge */}
        <View style={[sc.iconBadge, { backgroundColor: iconColor + '18', borderColor: iconColor + '33' }]}>
          <Ionicons name={iconName as any} size={18} color={iconColor} />
        </View>

        {/* Content */}
        <View style={sc.content}>
          <View style={sc.topRow}>
            <Text style={[sc.title, isUnread && sc.titleUnread]} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={sc.time}>{formatDate(notification.created_at)}</Text>
          </View>

          <Text style={[sc.message, isUnread && sc.messageUnread]} numberOfLines={2}>
            {notification.message}
          </Text>

          {/* Meta chips */}
          <View style={sc.metaRow}>
            {notification.order_number && (
              <View style={sc.metaChip}>
                <Ionicons name="receipt-outline" size={11} color={C.accent} />
                <Text style={sc.metaChipText}>#{notification.order_number}</Text>
              </View>
            )}
            {notification.customer_name && (
              <View style={[sc.metaChip, { borderColor: C.g4 }]}>
                <Ionicons name="person-outline" size={11} color={C.g2} />
                <Text style={[sc.metaChipText, { color: C.g2 }]}>{notification.customer_name}</Text>
              </View>
            )}
            {isLiveNotification && (
              <View style={sc.liveChip}>
                <View style={sc.liveDot} />
                <Text style={sc.liveText}>{liveChipLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right: unread dot + chevron */}
        <View style={sc.rightCol}>
          {isUnread && <View style={[sc.unreadDot, { backgroundColor: iconColor }]} />}
          <Ionicons name="chevron-forward" size={16} color={C.g4} style={sc.chevron} />
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────
// SkeletonLoader  (no text, unchanged)
// ─────────────────────────────────────────────
const SkeletonLoader = () => (
  <View style={sc.skeletonWrap}>
    {[1, 2, 3, 4, 5].map(i => (
      <View key={i} style={sc.skeletonCard}>
        <View style={sc.skeletonRail} />
        <View style={sc.skeletonIcon} />
        <View style={sc.skeletonBody}>
          <View style={sc.skeletonRow}>
            <View style={sc.skeletonTitle} />
            <View style={sc.skeletonTime} />
          </View>
          <View style={sc.skeletonMsg} />
          <View style={sc.skeletonMeta} />
        </View>
      </View>
    ))}
  </View>
);

// ─────────────────────────────────────────────
// EmptyState
// ─────────────────────────────────────────────
const EmptyState = ({
  onRefresh,
  title,
  sub,
  btnLabel,
}: {
  onRefresh: () => void;
  title: string;
  sub: string;
  btnLabel: string;
}) => (
  <View style={sc.emptyWrap}>
    <View style={sc.emptyIconWrap}>
      <Ionicons name="notifications-off-outline" size={36} color={C.g3} />
    </View>
    <Text style={sc.emptyTitle}>{title}</Text>
    <Text style={sc.emptySub}>{sub}</Text>
    <TouchableOpacity style={sc.emptyBtn} onPress={onRefresh} activeOpacity={0.8}>
      <Ionicons name="refresh" size={16} color={C.bg} />
      <Text style={sc.emptyBtnText}>{btnLabel}</Text>
    </TouchableOpacity>
  </View>
);

// ─────────────────────────────────────────────
// ErrorState
// ─────────────────────────────────────────────
const ErrorState = ({
  onRetry,
  title,
  sub,
  btnLabel,
}: {
  onRetry: () => void;
  title: string;
  sub: string;
  btnLabel: string;
}) => (
  <View style={sc.emptyWrap}>
    <View style={[sc.emptyIconWrap, { backgroundColor: C.dangerDim, borderColor: C.danger + '33' }]}>
      <Ionicons name="alert-circle-outline" size={36} color={C.danger} />
    </View>
    <Text style={sc.emptyTitle}>{title}</Text>
    <Text style={sc.emptySub}>{sub}</Text>
    <TouchableOpacity style={[sc.emptyBtn, { backgroundColor: C.danger }]} onPress={onRetry} activeOpacity={0.8}>
      <Ionicons name="refresh" size={16} color={C.white} />
      <Text style={[sc.emptyBtnText, { color: C.white }]}>{btnLabel}</Text>
    </TouchableOpacity>
  </View>
);

// ─────────────────────────────────────────────
// Main Screen — ALL LOGIC UNCHANGED
// ─────────────────────────────────────────────
const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const nt = t.notifications;

  const {
    unreadCount: wsUnreadCount,
    liveNotifications,
    clearLiveNotifications,
    markLiveNotificationAsRead,
    handleNotificationRead,
    isConnected,
    reconnectWebSocket,
    refreshUnreadCount: refreshWsUnreadCount,
  } = useDeliveryManNotifications();

  const [notifications, setNotifications]       = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]           = useState(0);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [apiNotifications, setApiNotifications] = useState<Notification[]>([]);
  const [error, setError]                       = useState<string | null>(null);
  const refreshIntervalRef                       = useRef<ReturnType<typeof setInterval> | null>(null);

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
            id:            wsNotif.id,
            order_id:      wsNotif.data?.order_id || null,
            type:          wsNotif.data?.type || 'general',
            title:         wsNotif.title,
            message:       wsNotif.message,
            is_read:       wsNotif.is_read ? 1 : 0,
            created_at:    wsNotif.created_at,
            order_number:  wsNotif.data?.order_number || null,
            status:        wsNotif.data?.status || null,
            customer_name: wsNotif.data?.customer_name || null,
          });
        }
      });

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(combined);
      setUnreadCount(combined.filter(n => n.is_read === 0).length);
      setError(null);
    } catch (err) {
      setError(nt.processError);
    }
  }, [apiNotifications, liveNotifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      const response = await fetch('https://ubua.cloud/api/delivery/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setApiNotifications(data.notifications || []);
      } else if (response.status === 401) {
        Alert.alert(t.common.sessionExpired, t.common.sessionExpiredMsg);
        await AsyncStorage.removeItem('deliveryManToken');
      } else {
        setError(nt.fetchError);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError(nt.networkError);
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
        headers: { Authorization: `Bearer ${token}` },
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
      Alert.alert(t.common.error, 'Failed to mark all notifications as read');
    }
  };

  const getNotificationIcon = useCallback((type: string, status: string | null) => {
    if (status) {
      switch (status) {
        case 'Pending':      return 'time-outline';
        case 'Preparing':    return 'restaurant-outline';
        case 'OutForDelivery': return 'bicycle-outline';
        case 'Delivered':    return 'checkmark-circle-outline';
        default:             return 'notifications-outline';
      }
    }

    switch (type) {
      case 'order_assigned':       return 'bag-add-outline';
      case 'order_delivered':      return 'checkmark-circle';
      case 'order_status_update':  return 'refresh-outline';
      case 'new_order_available':  return 'add-circle';
      default:                     return 'notifications-outline';
    }
  }, []);

  const getNotificationColor = useCallback((type: string, status: string | null) => {
    if (status) {
      switch (status) {
        case 'Pending':
        case 'Preparing':      return '#FF9500';
        case 'OutForDelivery': return '#2196F3';
        case 'Delivered':      return Colors.success;
        default:               return Colors.text.secondary;
      }
    }

    switch (type) {
      case 'order_assigned':      return Colors.primary;
      case 'order_delivered':     return Colors.success;
      case 'order_status_update': return '#2196F3';
      case 'new_order_available': return '#FF9500';
      default:                    return Colors.text.secondary;
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    const date    = new Date(dateString);
    const now     = new Date();
    const diff    = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);

    if (minutes < 1) return nt.justNow;
    if (minutes < 60) return nt.minutesAgo(minutes);
    if (hours < 24)   return nt.hoursAgo(hours);
    if (days < 7)     return nt.daysAgo(days);
    return date.toLocaleDateString();
  }, [nt]);

  // ── Header ──
  const renderHeader = () => (
    <LinearGradient
      colors={[C.headerTop, C.headerBot]}
      style={[styles.header, { paddingTop: insets.top + 10 }]}
    >
      {/* Decorative grid lines */}
      {[0.33, 0.66].map(p => (
        <View
          key={p}
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, {
            borderLeftWidth: 1,
            borderLeftColor: '#39E97B05',
            left: `${p * 100}%` as any,
          }]}
        />
      ))}

      <View style={styles.headerInner}>
        {/* Left — title + subtitle row */}
        <View style={styles.headerLeft}>
          <Text style={[styles.headerEyebrow, isRTL && styles.rtlText]}>{t.common.eyebrow}</Text>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{nt.title}</Text>
          <View style={[styles.headerMeta, isRTL && styles.rtlRow]}>
            <Text style={[styles.headerSub, isRTL && styles.rtlText]}>
              {unreadCount > 0 ? nt.unreadCount(unreadCount) : nt.allCaughtUp}
            </Text>

            {/* Connection chip */}
            <TouchableOpacity
              style={[styles.connChip, !isConnected && styles.connChipOffline]}
              onPress={!isConnected ? reconnectWebSocket : undefined}
              disabled={isConnected}
              activeOpacity={0.8}
            >
              <View style={[styles.connDot, { backgroundColor: isConnected ? C.accent : C.danger }]} />
              <Text style={[styles.connText, !isConnected && { color: C.danger }, isRTL && styles.rtlText]}>
                {isConnected ? nt.live : nt.offline}
              </Text>
              {!isConnected && (
                <Ionicons name="refresh" size={12} color={C.danger} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Right — mark all button + unread badge */}
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={styles.markAllBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="checkmark-done" size={16} color={C.accent} />
              <Text style={[styles.markAllText, isRTL && styles.rtlText]}>{nt.markAllRead}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bottom accent line */}
      <View style={styles.headerAccentLine} />
    </LinearGradient>
  );

  // ── Loading skeleton ──
  // ── Loading skeleton ──
  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        <SkeletonLoader />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {renderHeader()}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id.toString()}
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
            liveChipLabel={nt.liveChip}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.accent}
            colors={[C.accent]}
          />
        }
        ListEmptyComponent={
          error ? (
            <ErrorState
              onRetry={fetchNotifications}
              title={nt.errorTitle}
              sub={nt.errorSub}
              btnLabel={t.common.retry}
            />
          ) : (
            <EmptyState
              onRefresh={onRefresh}
              title={nt.noNotifications}
              sub={nt.noNotificationsSub}
              btnLabel={t.common.refresh}
            />
          )
        }
        showsVerticalScrollIndicator={false}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────
// Sub-component styles  (unchanged)
// ─────────────────────────────────────────────
const sc = StyleSheet.create({
  touchable: { marginBottom: SP.md },
  card: {
    flexDirection:   'row',
    alignItems:      'stretch',
    backgroundColor: C.bgCard,
    borderRadius:    R.lg,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     C.sep,
  },
  cardUnread: {
    backgroundColor: C.bgCardUnread,
    borderColor:     C.accentBorder,
  },
  rail: { width: 3, alignSelf: 'stretch' },
  iconBadge: {
    width:         40,
    height:        40,
    borderRadius:  R.md,
    justifyContent:'center',
    alignItems:    'center',
    alignSelf:     'center',
    marginLeft:    SP.md,
    marginRight:   SP.sm,
    borderWidth:   1,
  },
  content: { flex: 1, paddingVertical: SP.md, paddingRight: SP.sm },
  topRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   SP.xs,
  },
  title: { fontSize: 14, fontWeight: '600', color: C.g2, flex: 1, marginRight: SP.sm },
  titleUnread: { color: C.g1, fontWeight: '700' },
  time: { fontSize: 11, color: C.g3, fontWeight: '500' },
  message: { fontSize: 13, color: C.g3, lineHeight: 18, marginBottom: SP.sm },
  messageUnread: { color: C.g2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SP.sm },
  metaChip: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP.xs,
    backgroundColor: C.bgCardAlt,
    borderWidth:   1,
    borderColor:   C.accentBorder,
    paddingHorizontal: SP.sm,
    paddingVertical:   2,
    borderRadius:  R.round,
  },
  metaChipText: { fontSize: 11, color: C.accent, fontWeight: '600' },
  liveChip: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SP.xs,
    backgroundColor: C.accentDim,
    borderWidth:   1,
    borderColor:   C.accentBorder,
    paddingHorizontal: SP.sm,
    paddingVertical:   2,
    borderRadius:  R.round,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  liveText: { fontSize: 10, fontWeight: '800', color: C.accent, letterSpacing: 1.2 },
  rightCol: {
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: SP.md,
    paddingHorizontal: SP.md,
  },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  chevron: { marginTop: SP.sm },
  skeletonWrap: { padding: SP.lg, gap: SP.md },
  skeletonCard: {
    flexDirection:   'row',
    alignItems:      'stretch',
    backgroundColor: C.bgCard,
    borderRadius:    R.lg,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     C.sep,
    marginBottom:    SP.md,
  },
  skeletonRail: { width: 3, backgroundColor: C.g4 },
  skeletonIcon: {
    width: 40, height: 40, borderRadius: R.md,
    backgroundColor: C.g4, alignSelf: 'center', marginHorizontal: SP.md,
  },
  skeletonBody: { flex: 1, paddingVertical: SP.md, paddingRight: SP.md, gap: SP.sm },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skeletonTitle: { width: '55%', height: 13, backgroundColor: C.g4, borderRadius: R.sm },
  skeletonTime: { width: 32, height: 11, backgroundColor: C.g4, borderRadius: R.sm },
  skeletonMsg: { width: '88%', height: 11, backgroundColor: C.g4, borderRadius: R.sm },
  skeletonMeta: { width: '45%', height: 10, backgroundColor: C.g4, borderRadius: R.sm },
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 72, paddingHorizontal: SP.xl,
  },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.bgCardAlt, borderWidth: 1, borderColor: C.sep,
    alignItems: 'center', justifyContent: 'center', marginBottom: SP.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.g1, marginBottom: SP.sm, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.g3, textAlign: 'center', lineHeight: 20, marginBottom: SP.xl, maxWidth: 240 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SP.sm,
    backgroundColor: C.accent, paddingHorizontal: SP.xl,
    paddingVertical: 13, borderRadius: R.round,
    ...Platform.select({
      ios:     { shadowColor: C.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  emptyBtnText: { color: C.bg, fontSize: 14, fontWeight: '700' },
});

// ─────────────────────────────────────────────
// Main StyleSheet  (unchanged + rtl helpers)
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg, paddingBottom: 70 },
  header: {
    paddingHorizontal: SP.lg,
    paddingBottom:     SP.lg,
    overflow:          'hidden',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14 },
      android: { elevation: 10 },
    }),
  },
  headerInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerLeft: { flex: 1 },
  headerEyebrow: { fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 1.5, marginBottom: SP.xs },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.white, letterSpacing: -0.5, marginBottom: SP.xs },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginTop: 2 },
  headerSub: { fontSize: 13, color: C.g2, fontWeight: '500' },
  headerRight: { alignItems: 'flex-end', gap: SP.sm },
  unreadBadge: {
    backgroundColor: C.accent, minWidth: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: SP.xs,
  },
  unreadBadgeText: { fontSize: 12, fontWeight: '800', color: C.bg },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SP.xs + 2,
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder,
    paddingHorizontal: SP.md, paddingVertical: 8, borderRadius: R.round,
  },
  markAllText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  connChip: {
    flexDirection: 'row', alignItems: 'center', gap: SP.xs,
    backgroundColor: C.bgCardAlt, borderWidth: 1, borderColor: C.sep,
    paddingHorizontal: SP.sm, paddingVertical: 4, borderRadius: R.round,
  },
  connChipOffline: { borderColor: C.danger + '44', backgroundColor: C.dangerDim },
  connDot: { width: 6, height: 6, borderRadius: 3 },
  connText: { fontSize: 11, color: C.accent, fontWeight: '600' },
  headerAccentLine: {
    height: 2, backgroundColor: C.accent,
    marginTop: SP.lg, borderRadius: 1, opacity: 0.5,
  },
  listContent: { padding: SP.lg, paddingBottom: SP.xxl + 8, flexGrow: 1 },

  // RTL helpers
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  rtlRow: { flexDirection: 'row-reverse' },
});

export default NotificationsScreen;