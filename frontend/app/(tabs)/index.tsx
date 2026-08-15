import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Modal,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import axios from 'axios';
import Colors from '@/constants/Colors';
import { Skeleton, StatsCardSkeleton } from '@/components/ui/skeleton';
import { realtimeService } from '../services/realtimeService';
import { useLanguage } from '@/constants/contexts/LanguageContext';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────
// Design Tokens
// ─────────────────────────────────────────────
const T = {
  colors: {
    bg: '#0D0F12',
    bgCard: '#161A20',
    bgCardAlt: '#1C2128',
    accent: '#39E97B',
    accentDim: '#39E97B18',
    accentBorder: '#39E97B44',
    amber: '#F59E0B',
    amberDim: '#F59E0B18',
    blue: '#60A5FA',
    blueDim: '#60A5FA18',
    purple: '#A78BFA',
    purpleDim: '#A78BFA18',
    danger: '#EF4444',
    dangerDim: '#EF444418',
    orange: '#FB923C',
    orangeDim: '#FB923C18',
    indigo: '#818CF8',
    indigoDim: '#818CF818',
    white: '#FFFFFF',
    gray1: '#E8EAED',
    gray2: '#9CA3AF',
    gray3: '#4B5563',
    sep: '#1F2937',
    headerTop: '#0A0C0F',
    headerBot: '#161A20',
  },
  sp: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  r: { sm: 8, md: 12, lg: 16, xl: 20, round: 999 },
  shadow: {
    card: Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
    glow: Platform.select({
      ios: { shadowColor: '#39E97B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  typo: {
    heroNum: { fontSize: 48, fontWeight: '800' as const, letterSpacing: -1 },
    kpiNum: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    title: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
    sectionLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 },
    body: { fontSize: 15, fontWeight: '500' as const },
    caption: { fontSize: 12, fontWeight: '500' as const },
    micro: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5 },
  },
};

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────
interface Metrics {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  outForDeliveryOrders: number;
  cancelledOrders: number;
  preparingOrders: number;
  totalEarnings: number;
  totalDeliveryFees: number;
  totalOrderRevenue: number;
  averageOrderValue: number;
  todayOrders: number;
  todayCompleted: number;
  todayOutForDelivery: number;
  todayPending: number;
  todayPreparing: number;
  todayCancelled: number;
  todayEarnings: number;
  todayDeliveryFees: number;
  todayOrderRevenue: number;
  todayAverageOrderValue: number;
  yesterdayOrders: number;
  yesterdayCompleted: number;
  yesterdayOutForDelivery: number;
  yesterdayPending: number;
  yesterdayPreparing: number;
  yesterdayCancelled: number;
  yesterdayEarnings: number;
  yesterdayDeliveryFees: number;
  yesterdayOrderRevenue: number;
  yesterdayAverageOrderValue: number;
  weeklyOrders: number;
  weeklyCompleted: number;
  weeklyCancelled: number;
  weeklyPending: number;
  weeklyOutForDelivery: number;
  weeklyPreparing: number;
  weeklyEarnings: number;
  weeklyDeliveryFees: number;
  weeklyOrderRevenue: number;
  weeklyAvgOrderRevune: number;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

const SectionLabel = ({
  title,
  icon,
  isRTL = false,
}: {
  title: string;
  icon?: string;
  isRTL?: boolean;
}) => (
  <View style={[sc.sectionLabel, isRTL && { flexDirection: 'row-reverse' }]}>
    {icon && (
      <View style={sc.sectionLabelIcon}>
        <Ionicons name={icon as any} size={13} color={T.colors.accent} />
      </View>
    )}
    <Text style={sc.sectionLabelText}>{title.toUpperCase()}</Text>
  </View>
);

const StatCard = React.memo(({
  icon,
  title,
  value,
  color,
  suffix = '',
}: {
  icon: string;
  title: string;
  value: string | number;
  color: string;
  suffix?: string;
}) => (
  <View style={[sc.statCard, T.shadow.card]}>
    <View style={[sc.statAccent, { backgroundColor: color }]} />
    <View style={[sc.statIconWrap, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon as any} size={18} color={color} />
    </View>
    <Text style={sc.statNum}>{value}{suffix}</Text>
    <Text style={sc.statLabel}>{title}</Text>
  </View>
));

const EarningsBreakdownCard = React.memo(({
  title,
  totalEarnings,
  deliveryFees,
  orderRevenue,
  averageValue,
  color = T.colors.purple,
  labels,
  isRTL = false,
}: {
  title: string;
  totalEarnings: number;
  deliveryFees: number;
  orderRevenue: number;
  averageValue?: number;
  color?: string;
  labels: {
    totalEarnings: string;
    deliveryFees: string;
    orderRevenue: string;
    avgOrderValue: string;
  };
  isRTL?: boolean;
}) => (
  <View style={[sc.earningsCard, { borderTopColor: color }, T.shadow.card]}>
    <View style={[sc.earningsHeader, isRTL && { flexDirection: 'row-reverse' }]}>
      <View style={[sc.earningsIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name="cash-outline" size={16} color={color} />
      </View>
      <Text style={[sc.earningsTitle, isRTL && { textAlign: 'right' }]}>{title}</Text>
    </View>
    <View style={[sc.earningsTotal, isRTL && { flexDirection: 'row-reverse' }]}>
      <Text style={sc.earningsTotalNum}>{(totalEarnings || 0).toFixed(2)}</Text>
      <Text style={sc.earningsTotalCurrency}>MAD</Text>
    </View>
    <Text style={[sc.earningsTotalLabel, isRTL && { textAlign: 'right' }]}>{labels.totalEarnings}</Text>
    <View style={sc.earningsProgress}>
      <View style={[sc.earningsProgressFees, {
        width: `${(totalEarnings || 0) > 0 ? ((deliveryFees || 0) / (totalEarnings || 1)) * 100 : 0}%`,
        backgroundColor: T.colors.accent,
      }]} />
      <View style={[sc.earningsProgressRevenue, {
        width: `${(totalEarnings || 0) > 0 ? ((orderRevenue || 0) / (totalEarnings || 1)) * 100 : 0}%`,
        backgroundColor: color,
      }]} />
    </View>
    <View style={sc.earningsBreakdown}>
      <View style={[sc.earningsItem, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[sc.earningsDot, { backgroundColor: T.colors.accent }]} />
        <Text style={[sc.earningsItemLabel, isRTL && { textAlign: 'right' }]}>{labels.deliveryFees}</Text>
        <Text style={sc.earningsItemValue}>{(deliveryFees || 0).toFixed(2)} MAD</Text>
      </View>
      <View style={[sc.earningsItem, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={[sc.earningsDot, { backgroundColor: color }]} />
        <Text style={[sc.earningsItemLabel, isRTL && { textAlign: 'right' }]}>{labels.orderRevenue}</Text>
        <Text style={sc.earningsItemValue}>{(orderRevenue || 0).toFixed(2)} MAD</Text>
      </View>
      {averageValue !== undefined && averageValue > 0 && (
        <View style={[sc.earningsItem, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={[sc.earningsDot, { backgroundColor: T.colors.blue }]} />
          <Text style={[sc.earningsItemLabel, isRTL && { textAlign: 'right' }]}>{labels.avgOrderValue}</Text>
          <Text style={sc.earningsItemValue}>{(averageValue || 0).toFixed(2)} MAD</Text>
        </View>
      )}
    </View>
  </View>
));

const OrderStatusCard = React.memo(({
  title,
  total,
  completed,
  pending,
  preparing,
  outForDelivery,
  cancelled,
  color = T.colors.accent,
  labels,
  isRTL = false,
}: {
  title: string;
  total: number;
  completed: number;
  pending: number;
  preparing?: number;
  outForDelivery?: number;
  cancelled?: number;
  color?: string;
  labels: {
    total: string;
    done: string;
    pending: string;
    preparing: string;
    onRoad: string;
    cancelled: string;
    completion: (pct: number) => string;
  };
  isRTL?: boolean;
}) => (
  <View style={[sc.statusCard, { borderTopColor: color }, T.shadow.card]}>
    <View style={[sc.statusHeader, isRTL && { flexDirection: 'row-reverse' }]}>
      <View style={[sc.statusIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name="list-outline" size={16} color={color} />
      </View>
      <Text style={[sc.statusTitle, isRTL && { textAlign: 'right' }]}>{title}</Text>
    </View>
    <View style={sc.statusGrid}>
      {[
        { v: total, l: labels.total, c: T.colors.gray1 },
        { v: completed, l: labels.done, c: T.colors.accent },
        { v: pending, l: labels.pending, c: T.colors.amber },
        ...(preparing !== undefined && preparing > 0 ? [{ v: preparing, l: labels.preparing, c: T.colors.orange }] : []),
        ...(outForDelivery !== undefined ? [{ v: outForDelivery, l: labels.onRoad, c: T.colors.blue }] : []),
        ...(cancelled !== undefined && cancelled > 0 ? [{ v: cancelled, l: labels.cancelled, c: T.colors.danger }] : []),
      ].map(({ v, l, c }) => (
        <View key={l} style={sc.statusItem}>
          <Text style={[sc.statusNum, { color: c }]}>{v}</Text>
          <Text style={sc.statusLbl}>{l}</Text>
        </View>
      ))}
    </View>
    {total > 0 && (
      <View style={sc.completionWrap}>
        <View style={sc.completionTrack}>
          <View style={[sc.completionFill, {
            width: `${total > 0 ? (completed / total) * 100 : 0}%`,
            backgroundColor: color,
          }]} />
        </View>
        <Text style={sc.completionPct}>
          {labels.completion(total > 0 ? Math.round((completed / total) * 100) : 0)}
        </Text>
      </View>
    )}
  </View>
));

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
const DashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();

  const dashboardT = useMemo(() => {
    const common = t.common;

    return {
      eyebrowBase: common.eyebrow || 'ZESTY DRIVER',
      screenTitle: (t as any)?.home?.screenTitle || (t as any)?.dashboard?.screenTitle || (t as any)?.profile?.screenTitle || 'DRIVER CONSOLE',
      connectionErrorTitle: (t as any)?.home?.connectionErrorTitle || 'Connection Error',
      notAuthenticated: (t as any)?.home?.notAuthenticated || 'Not authenticated',
      noMetricsReceived: (t as any)?.home?.noMetricsReceived || 'No metrics data received',
      requestTimeout: (t as any)?.home?.requestTimeout || 'Request timeout. Please check your connection.',
      authFailed: (t as any)?.home?.authFailed || 'Authentication failed',
      failedToLoadMetrics: (t as any)?.home?.failedToLoadMetrics || 'Failed to load metrics',
      networkErrorSimple: (t as any)?.home?.networkErrorSimple || 'Network error',

      todayEarnings: (t as any)?.home?.todayEarnings || "Today's Earnings",
      deliveries: (t as any)?.home?.deliveries || 'Deliveries',
      completed: (t as any)?.home?.completed || 'Completed',
      avgOrder: (t as any)?.home?.avgOrder || 'Avg Order',
      vsYesterday: (pct: string) => ((t as any)?.home?.vsYesterday?.(pct) || `${pct}% vs yesterday`),

      orderOverview: (t as any)?.home?.orderOverview || 'Order Overview',
      totalOrders: (t as any)?.home?.totalOrders || 'Total Orders',
      pending: (t as any)?.home?.pending || 'Pending',
      preparing: (t as any)?.home?.preparing || 'Preparing',
      onRoad: (t as any)?.home?.onRoad || 'On Road',
      cancelled: (t as any)?.home?.cancelled || 'Cancelled',

      lifetimePerformance: (t as any)?.home?.lifetimePerformance || 'Lifetime Performance',
      overallOrderStatus: (t as any)?.home?.overallOrderStatus || 'Overall Order Status',
      lifetimeEarnings: (t as any)?.home?.lifetimeEarnings || 'Lifetime Earnings',
      totalEarningsLabel: (t as any)?.home?.totalEarningsLabel || 'Total Earnings',
      deliveryFees: (t as any)?.home?.deliveryFees || 'Delivery Fees',
      orderRevenue: (t as any)?.home?.orderRevenue || 'Order Revenue',
      avgOrderValue: (t as any)?.home?.avgOrderValue || 'Avg Order Value',
      done: (t as any)?.home?.done || 'Done',
      total: (t as any)?.home?.total || 'Total',
      completion: (pct: number) => ((t as any)?.home?.completion?.(pct) || `${pct}% completion`),

      todaysPerformance: (t as any)?.home?.todaysPerformance || "Today's Performance",
      yesterdaysPerformance: (t as any)?.home?.yesterdaysPerformance || "Yesterday's Performance",
      thisWeek: (t as any)?.home?.thisWeek || 'This Week',
      weeklyOrders: (t as any)?.home?.weeklyOrders || 'Weekly Orders',
      weeklyEarnings: (t as any)?.home?.weeklyEarnings || 'Weekly Earnings',
      earnings: (t as any)?.home?.earnings || 'Earnings',
      avgOrderShort: (t as any)?.home?.avgOrderShort || 'Avg Order',
      cancelShort: (t as any)?.home?.cancelShort || 'Cancel',

      performanceInsights: (t as any)?.home?.performanceInsights || 'Performance Insights',
      bestPerformance: (t as any)?.home?.bestPerformance || 'Best Performance',
      today: (t as any)?.home?.today || 'Today',
      yesterday: (t as any)?.home?.yesterday || 'Yesterday',
      totalRevenue: (t as any)?.home?.totalRevenue || 'Total Revenue',

      deepAnalysis: (t as any)?.home?.deepAnalysis || 'Deep Analysis',
      performanceInsightsModal: (t as any)?.home?.performanceInsightsModal || 'Performance Insights',
      performanceTrends: (t as any)?.home?.performanceTrends || 'Performance Trends',
      dailyOrdersComparison: (t as any)?.home?.dailyOrdersComparison || 'Daily Orders Comparison',
      todaysOrderBreakdown: (t as any)?.home?.todaysOrderBreakdown || "Today's Order Breakdown",
      earningsTrend: (t as any)?.home?.earningsTrend || 'Earnings Trend',
      todaysRevenueSplit: (t as any)?.home?.todaysRevenueSplit || "Today's Revenue Split",
      up: (t as any)?.home?.up || 'Up',
      down: (t as any)?.home?.down || 'Down',
      completedOfTotal: (done: number, total: number) => ((t as any)?.home?.completedOfTotal?.(done, total) || `${done} completed of ${total} total`),

      efficiencyMetrics: (t as any)?.home?.efficiencyMetrics || 'Efficiency Metrics',
      completionRate: (t as any)?.home?.completionRate || 'Completion Rate',
      cancelRate: (t as any)?.home?.cancelRate || 'Cancel Rate',
      avgOrderMad: (t as any)?.home?.avgOrderMad || 'Avg Order MAD',

      weeklySummary: (t as any)?.home?.weeklySummary || 'Weekly Summary',
      avgDaily: (t as any)?.home?.avgDaily || 'Avg Daily',
      successRate: (t as any)?.home?.successRate || 'Success Rate',
      weeklyEarningsCaption: (t as any)?.home?.weeklyEarningsCaption || 'Weekly Earnings',

      recommendations: (t as any)?.home?.recommendations || 'Recommendations',
      recCancellations: (t as any)?.home?.recCancellations || 'Cancellations increased today. Focus on order accuracy and communication.',
      recCompleted: (t as any)?.home?.recCompleted || 'Great job! More orders completed today than yesterday.',
      recAvgOrder: (t as any)?.home?.recAvgOrder || 'Consider upselling or suggesting add-ons to raise order value.',
      recSolid: (t as any)?.home?.recSolid || 'Solid performance across the board. Keep it up!',

      retry: common.retry || 'Retry',
      loadingMap: common.loadingMap || 'Loading map…',
      error: common.error || 'Error',
    };
  }, [t]);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [driverName, setDriverName] = useState<string>('');

  useEffect(() => {
    const loadDriverName = async () => {
      const data = await AsyncStorage.getItem('deliveryMan');
      if (data) {
        const parsed = JSON.parse(data);
        setDriverName(parsed.name?.split(' ')[0] || '');
      }
    };
    loadDriverName();
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        setError(dashboardT.notAuthenticated);
        setLoading(false);
        return;
      }

      const response = await axios.get('https://ubua.cloud/api/delivery/dashboard/metrics', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      const data = response.data;

      if (data.metrics) {
        const expectedMetrics = [
          'totalOrders', 'completedOrders', 'pendingOrders', 'outForDeliveryOrders', 'cancelledOrders', 'preparingOrders',
          'totalEarnings', 'totalDeliveryFees', 'totalOrderRevenue', 'averageOrderValue',
          'todayOrders', 'todayCompleted', 'todayOutForDelivery', 'todayPending', 'todayPreparing', 'todayCancelled',
          'todayEarnings', 'todayDeliveryFees', 'todayOrderRevenue', 'todayAverageOrderValue',
          'yesterdayOrders', 'yesterdayCompleted', 'yesterdayOutForDelivery', 'yesterdayPending', 'yesterdayPreparing', 'yesterdayCancelled',
          'yesterdayEarnings', 'yesterdayDeliveryFees', 'yesterdayOrderRevenue', 'yesterdayAverageOrderValue',
          'weeklyOrders', 'weeklyCompleted', 'weeklyCancelled', 'weeklyPending', 'weeklyOutForDelivery', 'weeklyPreparing',
          'weeklyEarnings', 'weeklyDeliveryFees', 'weeklyOrderRevenue', 'weeklyAvgOrderRevune',
        ];
        const receivedMetrics = Object.keys(data.metrics);
        const missingMetrics = expectedMetrics.filter(metric => !receivedMetrics.includes(metric));
        if (missingMetrics.length > 0) console.warn('Missing metrics:', missingMetrics);

        const completeMetrics: Metrics = {
          totalOrders: data.metrics.totalOrders || 0,
          completedOrders: data.metrics.completedOrders || 0,
          pendingOrders: data.metrics.pendingOrders || 0,
          outForDeliveryOrders: data.metrics.outForDeliveryOrders || 0,
          cancelledOrders: data.metrics.cancelledOrders || 0,
          preparingOrders: data.metrics.preparingOrders || 0,
          totalEarnings: data.metrics.totalEarnings || 0,
          totalDeliveryFees: data.metrics.totalDeliveryFees || 0,
          totalOrderRevenue: data.metrics.totalOrderRevenue || 0,
          averageOrderValue: data.metrics.averageOrderValue || 0,
          todayOrders: data.metrics.todayOrders || 0,
          todayCompleted: data.metrics.todayCompleted || 0,
          todayOutForDelivery: data.metrics.todayOutForDelivery || 0,
          todayPending: data.metrics.todayPending || 0,
          todayPreparing: data.metrics.todayPreparing || 0,
          todayCancelled: data.metrics.todayCancelled || 0,
          todayEarnings: data.metrics.todayEarnings || 0,
          todayDeliveryFees: data.metrics.todayDeliveryFees || 0,
          todayOrderRevenue: data.metrics.todayOrderRevenue || 0,
          todayAverageOrderValue: data.metrics.todayAverageOrderValue || 0,
          yesterdayOrders: data.metrics.yesterdayOrders || 0,
          yesterdayCompleted: data.metrics.yesterdayCompleted || 0,
          yesterdayOutForDelivery: data.metrics.yesterdayOutForDelivery || 0,
          yesterdayPending: data.metrics.yesterdayPending || 0,
          yesterdayPreparing: data.metrics.yesterdayPreparing || 0,
          yesterdayCancelled: data.metrics.yesterdayCancelled || 0,
          yesterdayEarnings: data.metrics.yesterdayEarnings || 0,
          yesterdayDeliveryFees: data.metrics.yesterdayDeliveryFees || 0,
          yesterdayOrderRevenue: data.metrics.yesterdayOrderRevenue || 0,
          yesterdayAverageOrderValue: data.metrics.yesterdayAverageOrderValue || 0,
          weeklyOrders: data.metrics.weeklyOrders || 0,
          weeklyCompleted: data.metrics.weeklyCompleted || 0,
          weeklyCancelled: data.metrics.weeklyCancelled || 0,
          weeklyPending: data.metrics.weeklyPending || 0,
          weeklyOutForDelivery: data.metrics.weeklyOutForDelivery || 0,
          weeklyPreparing: data.metrics.weeklyPreparing || 0,
          weeklyEarnings: data.metrics.weeklyEarnings || 0,
          weeklyDeliveryFees: data.metrics.weeklyDeliveryFees || 0,
          weeklyOrderRevenue: data.metrics.weeklyOrderRevenue || 0,
          weeklyAvgOrderRevune: data.metrics.weeklyAvgOrderRevune || 0,
        };
        setMetrics(completeMetrics);
      } else {
        setError(dashboardT.noMetricsReceived);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === 'ECONNABORTED') {
          setError(dashboardT.requestTimeout);
        } else if (err.response?.status === 401) {
          setError(dashboardT.authFailed);
        } else {
          setError(err.response?.data?.message || dashboardT.failedToLoadMetrics);
        }
      } else {
        setError(dashboardT.networkErrorSimple);
      }
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dashboardT]);

  useEffect(() => {
    fetchMetrics();
    const unsubscribe = realtimeService.subscribe('dashboard', fetchMetrics, 10000);
    return () => { unsubscribe(); };
  }, [fetchMetrics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMetrics();
  }, [fetchMetrics]);

  const renderSkeleton = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroSkeletonWrap}>
        <Skeleton width={200} height={56} borderRadius={8} style={{ marginBottom: 8 }} />
        <Skeleton width={120} height={16} borderRadius={4} />
      </View>
      <View style={styles.statsGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={[sc.statCard, { alignItems: 'flex-start' }]}>
            <Skeleton width={36} height={36} borderRadius={8} style={{ marginBottom: 10 }} />
            <Skeleton width={60} height={22} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton width={80} height={12} borderRadius={4} />
          </View>
        ))}
      </View>
      <Skeleton width="100%" height={160} borderRadius={T.r.lg} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={200} borderRadius={T.r.lg} style={{ marginBottom: 16 }} />
    </ScrollView>
  );

  if (loading && !metrics) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={T.colors.bg} />
        <View style={[styles.topBar, isRTL && { flexDirection: 'row-reverse' }]}>
          <View>
            <Text style={[styles.topBarEyebrow, isRTL && { textAlign: 'right' }]}>{dashboardT.eyebrowBase}</Text>
            <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.screenTitle}</Text>
          </View>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="small" color={T.colors.accent} />
          </View>
        </View>
        {renderSkeleton()}
      </View>
    );
  }

  if (error && !metrics) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={T.colors.bg} />
        <View style={[styles.topBar, isRTL && { flexDirection: 'row-reverse' }]}>
          <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.screenTitle}</Text>
        </View>
        <View style={styles.errorWrap}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={T.colors.amber} />
          </View>
          <Text style={styles.errorTitle}>{dashboardT.connectionErrorTitle}</Text>
          <Text style={styles.errorBody}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchMetrics} activeOpacity={0.8}>
            <Ionicons name="refresh" size={18} color={T.colors.bg} />
            <Text style={styles.retryBtnText}>{dashboardT.retry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const earningsTrend = metrics
    ? metrics.todayEarnings > metrics.yesterdayEarnings ? 'up' : metrics.todayEarnings < metrics.yesterdayEarnings ? 'down' : 'flat'
    : 'flat';

  // Mirrors the tab bar in app/(tabs)/_layout.tsx: bottom: SPACING.lg, height: 64 + insets.bottom
  const tabBarClearance = 16 + 64 + insets.bottom + 24;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={T.colors.bg} />

      <LinearGradient
        colors={[T.colors.headerTop, T.colors.headerBot]}
        style={styles.topBarGradient}
      >
        {[0.25, 0.5, 0.75].map((p) => (
          <View
            key={p}
            style={[StyleSheet.absoluteFillObject, {
              borderLeftWidth: 1,
              borderLeftColor: '#39E97B05',
              left: `${p * 100}%` as any,
            }]}
            pointerEvents="none"
          />
        ))}

        <View style={[styles.topBarRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <View>
            <Text style={[styles.topBarEyebrow, isRTL && { textAlign: 'right' }]}>
              {driverName ? `${dashboardT.eyebrowBase}, ${driverName.toUpperCase()}` : dashboardT.eyebrowBase}
            </Text>
            <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.screenTitle}</Text>
            <Text style={[styles.topBarDate, isRTL && { textAlign: 'right' }]}>
              {new Date().toLocaleDateString(isRTL ? 'ar' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.analysisBtn}
            onPress={() => setShowAnalysisModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="stats-chart" size={20} color={T.colors.accent} />
          </TouchableOpacity>
        </View>
        <View style={styles.topBarAccentLine} />
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.colors.accent} colors={[T.colors.accent]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && metrics ? (
          renderSkeleton()
        ) : metrics ? (
          <>
            <LinearGradient
              colors={['#0F1F16', '#182D1E']}
              style={[styles.heroCard, T.shadow.glow]}
            >
              <View style={[styles.heroTopRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={[styles.heroLabelChip, isRTL && { flexDirection: 'row-reverse' }]}>
                  <Ionicons name="flash" size={12} color={T.colors.accent} />
                  <Text style={styles.heroLabelText}>{dashboardT.todayEarnings.toUpperCase()}</Text>
                </View>
                <View style={[
                  styles.heroTrend,
                  { backgroundColor: earningsTrend === 'up' ? T.colors.accentDim : T.colors.dangerDim }
                ]}>
                  <Ionicons
                    name={earningsTrend === 'up' ? 'trending-up' : earningsTrend === 'down' ? 'trending-down' : 'remove'}
                    size={14}
                    color={earningsTrend === 'up' ? T.colors.accent : T.colors.danger}
                  />
                  <Text style={[styles.heroTrendText, { color: earningsTrend === 'up' ? T.colors.accent : T.colors.danger }]}>
                    {metrics.yesterdayEarnings > 0
                      ? dashboardT.vsYesterday(Math.abs(((metrics.todayEarnings - metrics.yesterdayEarnings) / metrics.yesterdayEarnings) * 100).toFixed(1))
                      : dashboardT.vsYesterday('0')}
                  </Text>
                </View>
              </View>
              <View style={[styles.heroNumRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Text style={styles.heroNum}>{metrics.todayEarnings.toFixed(2)}</Text>
                <Text style={styles.heroCurrency}>MAD</Text>
              </View>
              <View style={[styles.heroSubRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.heroSubItem}>
                  <Text style={styles.heroSubLabel}>{dashboardT.deliveries.toUpperCase()}</Text>
                  <Text style={styles.heroSubValue}>{metrics.todayOrders}</Text>
                </View>
                <View style={styles.heroSubDivider} />
                <View style={styles.heroSubItem}>
                  <Text style={styles.heroSubLabel}>{dashboardT.completed.toUpperCase()}</Text>
                  <Text style={[styles.heroSubValue, { color: T.colors.accent }]}>{metrics.todayCompleted}</Text>
                </View>
                <View style={styles.heroSubDivider} />
                <View style={styles.heroSubItem}>
                  <Text style={styles.heroSubLabel}>{dashboardT.avgOrder.toUpperCase()}</Text>
                  <Text style={styles.heroSubValue}>{metrics.todayAverageOrderValue.toFixed(0)} MAD</Text>
                </View>
              </View>
            </LinearGradient>

            <SectionLabel title={dashboardT.orderOverview} icon="cube-outline" isRTL={isRTL} />
            <View style={styles.statsGrid}>
              <StatCard icon="bag-check" title={dashboardT.totalOrders} value={metrics.totalOrders} color={T.colors.accent} />
              <StatCard icon="checkmark-circle" title={dashboardT.completed} value={metrics.completedOrders} color={T.colors.accent} />
              <StatCard icon="time" title={dashboardT.pending} value={metrics.pendingOrders} color={T.colors.amber} />
              <StatCard icon="restaurant" title={dashboardT.preparing} value={metrics.preparingOrders} color={T.colors.orange} />
              <StatCard icon="bicycle" title={dashboardT.onRoad} value={metrics.outForDeliveryOrders} color={T.colors.blue} />
              <StatCard icon="close-circle" title={dashboardT.cancelled} value={metrics.cancelledOrders} color={T.colors.danger} />
            </View>

            <SectionLabel title={dashboardT.lifetimePerformance} icon="trophy-outline" isRTL={isRTL} />
            <View style={styles.section}>
              <OrderStatusCard
                title={dashboardT.overallOrderStatus}
                total={metrics.totalOrders}
                completed={metrics.completedOrders}
                pending={metrics.pendingOrders}
                preparing={metrics.preparingOrders}
                outForDelivery={metrics.outForDeliveryOrders}
                cancelled={metrics.cancelledOrders}
                color={T.colors.accent}
                isRTL={isRTL}
                labels={{
                  total: dashboardT.total,
                  done: dashboardT.done,
                  pending: dashboardT.pending,
                  preparing: dashboardT.preparing,
                  onRoad: dashboardT.onRoad,
                  cancelled: dashboardT.cancelled,
                  completion: dashboardT.completion,
                }}
              />
              <EarningsBreakdownCard
                title={dashboardT.lifetimeEarnings}
                totalEarnings={metrics.totalEarnings}
                deliveryFees={metrics.totalDeliveryFees}
                orderRevenue={metrics.totalOrderRevenue}
                averageValue={metrics.averageOrderValue}
                color={T.colors.purple}
                isRTL={isRTL}
                labels={{
                  totalEarnings: dashboardT.totalEarningsLabel,
                  deliveryFees: dashboardT.deliveryFees,
                  orderRevenue: dashboardT.orderRevenue,
                  avgOrderValue: dashboardT.avgOrderValue,
                }}
              />
            </View>

            <SectionLabel title={dashboardT.todaysPerformance} icon="sunny-outline" isRTL={isRTL} />
            <View style={[styles.compactCard, T.shadow.card]}>
              <View style={[styles.compactGrid, isRTL && { flexDirection: 'row-reverse' }]}>
                {[
                  { v: metrics.todayOrders, l: dashboardT.total, c: T.colors.gray1 },
                  { v: metrics.todayCompleted, l: dashboardT.done, c: T.colors.accent },
                  { v: metrics.todayPending, l: dashboardT.pending, c: T.colors.amber },
                  { v: metrics.todayPreparing, l: dashboardT.preparing, c: T.colors.orange },
                  { v: metrics.todayOutForDelivery, l: dashboardT.onRoad, c: T.colors.blue },
                  { v: metrics.todayCancelled, l: dashboardT.cancelShort, c: T.colors.danger },
                ].map(({ v, l, c }) => (
                  <View key={l} style={styles.compactItem}>
                    <Text style={[styles.compactNum, { color: c }]}>{v}</Text>
                    <Text style={styles.compactLbl}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.compactEarningsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="cash" size={14} color={T.colors.accent} />
                <Text style={styles.compactEarningsText}>{dashboardT.earnings}: <Text style={styles.compactEarningsVal}>{metrics.todayEarnings.toFixed(2)} MAD</Text></Text>
              </View>
              <View style={[styles.compactEarningsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="bicycle" size={14} color={T.colors.blue} />
                <Text style={styles.compactEarningsText}>{dashboardT.deliveryFees}: <Text style={styles.compactEarningsVal}>{metrics.todayDeliveryFees.toFixed(2)} MAD</Text></Text>
              </View>
              <View style={[styles.compactEarningsRow, { borderBottomWidth: 0 }, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="trending-up" size={14} color={T.colors.purple} />
                <Text style={styles.compactEarningsText}>{dashboardT.avgOrderValue}: <Text style={styles.compactEarningsVal}>{metrics.todayAverageOrderValue.toFixed(2)} MAD</Text></Text>
              </View>
            </View>

            <SectionLabel title={dashboardT.yesterdaysPerformance} icon="moon-outline" isRTL={isRTL} />
            <View style={[styles.compactCard, T.shadow.card]}>
              <View style={[styles.compactGrid, isRTL && { flexDirection: 'row-reverse' }]}>
                {[
                  { v: metrics.yesterdayOrders, l: dashboardT.total, c: T.colors.gray1 },
                  { v: metrics.yesterdayCompleted, l: dashboardT.done, c: T.colors.accent },
                  { v: metrics.yesterdayPending, l: dashboardT.pending, c: T.colors.amber },
                  { v: metrics.yesterdayPreparing, l: dashboardT.preparing, c: T.colors.orange },
                  { v: metrics.yesterdayOutForDelivery, l: dashboardT.onRoad, c: T.colors.blue },
                  { v: metrics.yesterdayCancelled, l: dashboardT.cancelShort, c: T.colors.danger },
                ].map(({ v, l, c }) => (
                  <View key={l} style={styles.compactItem}>
                    <Text style={[styles.compactNum, { color: c }]}>{v}</Text>
                    <Text style={styles.compactLbl}>{l}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.compactEarningsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="cash" size={14} color={T.colors.gray2} />
                <Text style={styles.compactEarningsText}>{dashboardT.earnings}: <Text style={styles.compactEarningsVal}>{metrics.yesterdayEarnings.toFixed(2)} MAD</Text></Text>
              </View>
              <View style={[styles.compactEarningsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="bicycle" size={14} color={T.colors.indigo} />
                <Text style={styles.compactEarningsText}>{dashboardT.deliveryFees}: <Text style={styles.compactEarningsVal}>{metrics.yesterdayDeliveryFees.toFixed(2)} MAD</Text></Text>
              </View>
              <View style={[styles.compactEarningsRow, { borderBottomWidth: 0 }, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="trending-up" size={14} color={T.colors.accent} />
                <Text style={styles.compactEarningsText}>{dashboardT.avgOrderValue}: <Text style={styles.compactEarningsVal}>{metrics.yesterdayAverageOrderValue.toFixed(2)} MAD</Text></Text>
              </View>
            </View>

            <SectionLabel title={dashboardT.thisWeek} icon="calendar-outline" isRTL={isRTL} />
            <View style={styles.section}>
              <OrderStatusCard
                title={dashboardT.weeklyOrders}
                total={metrics.weeklyOrders}
                completed={metrics.weeklyCompleted}
                pending={metrics.weeklyPending}
                preparing={metrics.weeklyPreparing}
                outForDelivery={metrics.weeklyOutForDelivery}
                cancelled={metrics.weeklyCancelled}
                color={T.colors.accent}
                isRTL={isRTL}
                labels={{
                  total: dashboardT.total,
                  done: dashboardT.done,
                  pending: dashboardT.pending,
                  preparing: dashboardT.preparing,
                  onRoad: dashboardT.onRoad,
                  cancelled: dashboardT.cancelled,
                  completion: dashboardT.completion,
                }}
              />
              <EarningsBreakdownCard
                title={dashboardT.weeklyEarnings}
                totalEarnings={metrics.weeklyEarnings}
                deliveryFees={metrics.weeklyDeliveryFees}
                orderRevenue={metrics.weeklyOrderRevenue}
                averageValue={metrics.weeklyAvgOrderRevune}
                color={T.colors.purple}
                isRTL={isRTL}
                labels={{
                  totalEarnings: dashboardT.totalEarningsLabel,
                  deliveryFees: dashboardT.deliveryFees,
                  orderRevenue: dashboardT.orderRevenue,
                  avgOrderValue: dashboardT.avgOrderValue,
                }}
              />
              <View style={styles.weeklyStatGrid}>
                {[
                  { icon: 'bag-check', val: metrics.weeklyOrders, lbl: dashboardT.totalOrders, c: T.colors.accent },
                  { icon: 'checkmark-circle', val: metrics.weeklyCompleted, lbl: dashboardT.completed, c: T.colors.accent },
                  { icon: 'time', val: metrics.weeklyPending, lbl: dashboardT.pending, c: T.colors.amber },
                  { icon: 'restaurant', val: metrics.weeklyPreparing, lbl: dashboardT.preparing, c: T.colors.orange },
                  { icon: 'bicycle', val: metrics.weeklyOutForDelivery, lbl: dashboardT.onRoad, c: T.colors.blue },
                  { icon: 'close-circle', val: metrics.weeklyCancelled, lbl: dashboardT.cancelled, c: T.colors.danger },
                  { icon: 'cash', val: `${metrics.weeklyEarnings.toFixed(0)} MAD`, lbl: dashboardT.earnings, c: T.colors.purple },
                  { icon: 'trending-up', val: `${metrics.weeklyAvgOrderRevune.toFixed(0)} MAD`, lbl: dashboardT.avgOrderShort, c: T.colors.blue },
                ].map(({ icon, val, lbl, c }) => (
                  <View key={lbl} style={[sc.weeklyMiniCard, T.shadow.card]}>
                    <View style={[sc.weeklyMiniIcon, { backgroundColor: c + '18' }]}>
                      <Ionicons name={icon as any} size={14} color={c} />
                    </View>
                    <Text style={[sc.weeklyMiniVal, { color: c }]}>{val}</Text>
                    <Text style={sc.weeklyMiniLbl}>{lbl}</Text>
                  </View>
                ))}
              </View>
            </View>

            <SectionLabel title={dashboardT.performanceInsights} icon="bulb-outline" isRTL={isRTL} />
            <View style={[styles.insightsCard, T.shadow.card]}>
              {[
                {
                  icon: metrics.todayOrders >= metrics.yesterdayOrders ? 'checkmark-circle' : 'trending-down',
                  color: metrics.todayOrders >= metrics.yesterdayOrders ? T.colors.accent : T.colors.danger,
                  label: dashboardT.bestPerformance,
                  value: `${metrics.todayOrders >= metrics.yesterdayOrders ? dashboardT.today : dashboardT.yesterday} — ${Math.max(metrics.todayOrders, metrics.yesterdayOrders)} ${dashboardT.totalOrders.toLowerCase()}`,
                  sub: undefined,
                },
                {
                  icon: 'cash',
                  color: T.colors.purple,
                  label: dashboardT.totalRevenue,
                  value: `${(metrics.totalEarnings || 0).toFixed(2)} MAD`,
                  sub: `${(metrics.totalDeliveryFees || 0).toFixed(2)} ${dashboardT.deliveryFees.toLowerCase()} + ${(metrics.totalOrderRevenue || 0).toFixed(2)} ${dashboardT.orderRevenue.toLowerCase()}`,
                },
                {
                  icon: 'trending-up',
                  color: T.colors.accent,
                  label: dashboardT.avgOrderValue,
                  value: `${(metrics.averageOrderValue || 0).toFixed(2)} MAD`,
                  sub: undefined,
                },
              ].map(({ icon, color, label, value, sub }, idx, arr) => (
                <View key={label}>
                  <View style={[styles.insightRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={[styles.insightIconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon as any} size={16} color={color} />
                    </View>
                    <View style={styles.insightText}>
                      <Text style={[styles.insightLabel, isRTL && { textAlign: 'right' }]}>{label}</Text>
                      <Text style={[styles.insightValue, isRTL && { textAlign: 'right' }]}>{value}</Text>
                      {sub && <Text style={[styles.insightSub, isRTL && { textAlign: 'right' }]}>{sub}</Text>}
                    </View>
                  </View>
                  {idx < arr.length - 1 && <View style={styles.insightDivider} />}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={showAnalysisModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAnalysisModal(false)}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={[T.colors.headerTop, T.colors.headerBot]}
            style={styles.topBarGradient}
          >
            <View style={[styles.topBarRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View>
                <Text style={[styles.topBarEyebrow, isRTL && { textAlign: 'right' }]}>{dashboardT.deepAnalysis.toUpperCase()}</Text>
                <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.performanceInsightsModal.toUpperCase()}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAnalysisModal(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={T.colors.white} />
              </TouchableOpacity>
            </View>
            <View style={styles.topBarAccentLine} />
          </LinearGradient>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <SectionLabel title={dashboardT.performanceTrends} icon="trending-up-outline" isRTL={isRTL} />
            <View style={[styles.chartCard, T.shadow.card]}>
              <Text style={[styles.chartTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.dailyOrdersComparison}</Text>
              {[
                { label: dashboardT.yesterday, val: metrics?.yesterdayOrders ?? 0, color: T.colors.gray3 },
                { label: dashboardT.today, val: metrics?.todayOrders ?? 0, color: T.colors.accent },
              ].map(({ label, val, color }) => {
                const max = Math.max(metrics?.todayOrders ?? 0, metrics?.yesterdayOrders ?? 0, 1);
                return (
                  <View key={label} style={[styles.barRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.barLabel, isRTL && { textAlign: 'right' }]}>{label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min((val / max) * 100, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.barVal, isRTL && { textAlign: 'left' }]}>{val}</Text>
                  </View>
                );
              })}
              <Text style={[styles.chartInsight, isRTL && { textAlign: 'right' }]}>
                {(metrics?.todayOrders ?? 0) > (metrics?.yesterdayOrders ?? 0) ? `📈 ${dashboardT.up}` : `📉 ${dashboardT.down}`} {dashboardT.vsYesterday(
                  (metrics?.yesterdayOrders ?? 0) > 0
                    ? Math.abs((((metrics?.todayOrders ?? 0) - (metrics?.yesterdayOrders ?? 0)) / (metrics?.yesterdayOrders ?? 1)) * 100).toFixed(1)
                    : '0'
                )}
              </Text>
            </View>

            <View style={[styles.chartCard, T.shadow.card]}>
              <Text style={[styles.chartTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.todaysOrderBreakdown}</Text>
              {[
                { label: dashboardT.completed, val: metrics?.todayCompleted ?? 0, color: T.colors.accent },
                { label: dashboardT.preparing, val: metrics?.todayPreparing ?? 0, color: T.colors.orange },
                { label: dashboardT.onRoad, val: metrics?.todayOutForDelivery ?? 0, color: T.colors.blue },
                { label: dashboardT.cancelled, val: metrics?.todayCancelled ?? 0, color: T.colors.danger },
              ].map(({ label, val, color }) => {
                const max = Math.max(metrics?.todayOrders ?? 0, 1);
                return (
                  <View key={label} style={[styles.barRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.barLabel, isRTL && { textAlign: 'right' }]}>{label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min((val / max) * 100, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.barVal, isRTL && { textAlign: 'left' }]}>{val}</Text>
                  </View>
                );
              })}
              <Text style={[styles.chartInsight, isRTL && { textAlign: 'right' }]}>
                📊 {dashboardT.completedOfTotal(metrics?.todayCompleted ?? 0, metrics?.todayOrders ?? 0)}
              </Text>
            </View>

            <View style={[styles.chartCard, T.shadow.card]}>
              <Text style={[styles.chartTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.earningsTrend}</Text>
              {[
                { label: dashboardT.yesterday, val: metrics?.yesterdayEarnings ?? 0, color: T.colors.gray3 },
                { label: dashboardT.today, val: metrics?.todayEarnings ?? 0, color: T.colors.accent },
              ].map(({ label, val, color }) => {
                const max = Math.max(metrics?.todayEarnings ?? 0, metrics?.yesterdayEarnings ?? 0, 1);
                return (
                  <View key={label} style={[styles.barRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.barLabel, isRTL && { textAlign: 'right' }]}>{label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min((val / max) * 100, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.barVal, isRTL && { textAlign: 'left' }]}>{val.toFixed(0)}</Text>
                  </View>
                );
              })}
              <Text style={[styles.chartInsight, isRTL && { textAlign: 'right' }]}>
                {(metrics?.todayEarnings ?? 0) > (metrics?.yesterdayEarnings ?? 0) ? `💰 ${dashboardT.up}` : `💸 ${dashboardT.down}`} {dashboardT.vsYesterday(
                  (metrics?.yesterdayEarnings ?? 0) > 0
                    ? Math.abs((((metrics?.todayEarnings ?? 0) - (metrics?.yesterdayEarnings ?? 0)) / (metrics?.yesterdayEarnings ?? 1)) * 100).toFixed(1)
                    : '0'
                )}
              </Text>
            </View>

            <View style={[styles.chartCard, T.shadow.card]}>
              <Text style={[styles.chartTitle, isRTL && { textAlign: 'right' }]}>{dashboardT.todaysRevenueSplit}</Text>
              {[
                { label: dashboardT.deliveryFees, val: metrics?.todayDeliveryFees ?? 0, color: T.colors.indigo },
                { label: dashboardT.orderRevenue, val: metrics?.todayOrderRevenue ?? 0, color: T.colors.purple },
              ].map(({ label, val, color }) => {
                const max = Math.max(metrics?.todayOrderRevenue ?? 0, 1);
                return (
                  <View key={label} style={[styles.barRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={[styles.barLabel, isRTL && { textAlign: 'right' }]}>{label}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.min((val / max) * 100, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.barVal, isRTL && { textAlign: 'left' }]}>{val.toFixed(0)}</Text>
                  </View>
                );
              })}
              <Text style={[styles.chartInsight, isRTL && { textAlign: 'right' }]}>
                {dashboardT.total}: {(metrics?.todayEarnings ?? 0).toFixed(2)} MAD
              </Text>
            </View>

            <SectionLabel title={dashboardT.efficiencyMetrics} icon="speedometer-outline" isRTL={isRTL} />
            <View style={[styles.efficiencyCard, T.shadow.card]}>
              <View style={[styles.efficiencyRow, isRTL && { flexDirection: 'row-reverse' }]}>
                {[
                  { icon: 'checkmark-circle-outline', color: T.colors.accent, val: `${(metrics?.totalOrders ?? 0) > 0 ? (((metrics?.completedOrders ?? 0) / (metrics?.totalOrders ?? 1)) * 100).toFixed(1) : 0}%`, lbl: dashboardT.completionRate },
                  { icon: 'close-circle-outline', color: T.colors.danger, val: `${(metrics?.totalOrders ?? 0) > 0 ? (((metrics?.cancelledOrders ?? 0) / (metrics?.totalOrders ?? 1)) * 100).toFixed(1) : 0}%`, lbl: dashboardT.cancelRate },
                  { icon: 'cash-outline', color: T.colors.purple, val: `${(metrics?.averageOrderValue ?? 0).toFixed(1)}`, lbl: dashboardT.avgOrderMad },
                ].map(({ icon, color, val, lbl }) => (
                  <View key={lbl} style={styles.efficiencyItem}>
                    <View style={[styles.efficiencyIconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon as any} size={20} color={color} />
                    </View>
                    <Text style={[styles.efficiencyVal, { color }]}>{val}</Text>
                    <Text style={styles.efficiencyLbl}>{lbl}</Text>
                  </View>
                ))}
              </View>
            </View>

            <SectionLabel title={dashboardT.weeklySummary} icon="calendar-outline" isRTL={isRTL} />
            <View style={[styles.weeklySummaryCard, T.shadow.card]}>
              <View style={[styles.weeklySummaryRow, isRTL && { flexDirection: 'row-reverse' }]}>
                {[
                  { val: metrics?.weeklyOrders ?? 0, lbl: dashboardT.total },
                  { val: metrics?.weeklyCompleted ?? 0, lbl: dashboardT.completed },
                  { val: metrics?.weeklyCancelled ?? 0, lbl: dashboardT.cancelled },
                ].map(({ val, lbl }) => (
                  <View key={lbl} style={styles.weeklySummaryItem}>
                    <Text style={styles.weeklySummaryNum}>{val}</Text>
                    <Text style={styles.weeklySummaryLbl}>{lbl}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.weeklySummaryDetails, isRTL && { flexDirection: 'row-reverse' }]}>
                {[
                  { lbl: dashboardT.avgDaily, val: `${((metrics?.weeklyOrders ?? 0) / 7).toFixed(1)}` },
                  { lbl: dashboardT.avgOrderValue, val: `${(metrics?.weeklyAvgOrderRevune ?? 0).toFixed(1)} MAD` },
                  { lbl: dashboardT.successRate, val: `${(metrics?.weeklyOrders ?? 0) > 0 ? (((metrics?.weeklyCompleted ?? 0) / (metrics?.weeklyOrders ?? 1)) * 100).toFixed(1) : 0}%` },
                ].map(({ lbl, val }) => (
                  <View key={lbl} style={styles.weeklySummaryDetailItem}>
                    <Text style={styles.weeklySummaryDetailLbl}>{lbl}</Text>
                    <Text style={styles.weeklySummaryDetailVal}>{val}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.weeklyEarningsBanner, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="wallet-outline" size={18} color={T.colors.purple} />
                <Text style={styles.weeklyEarningsBig}>{(metrics?.weeklyEarnings ?? 0).toFixed(2)} MAD</Text>
                <Text style={styles.weeklyEarningsCaption}>{dashboardT.weeklyEarningsCaption}</Text>
              </View>
            </View>

            <SectionLabel title={dashboardT.recommendations} icon="bulb-outline" isRTL={isRTL} />
            <View style={[styles.recsCard, T.shadow.card]}>
              {(metrics?.todayCancelled ?? 0) > (metrics?.yesterdayCancelled ?? 0) && (
                <View style={[styles.recRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[styles.recIcon, { backgroundColor: T.colors.amberDim }]}>
                    <Ionicons name="alert-circle" size={16} color={T.colors.amber} />
                  </View>
                  <Text style={[styles.recText, isRTL && { textAlign: 'right' }]}>{dashboardT.recCancellations}</Text>
                </View>
              )}
              {(metrics?.todayCompleted ?? 0) > (metrics?.yesterdayCompleted ?? 0) && (
                <View style={[styles.recRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[styles.recIcon, { backgroundColor: T.colors.accentDim }]}>
                    <Ionicons name="checkmark-circle" size={16} color={T.colors.accent} />
                  </View>
                  <Text style={[styles.recText, isRTL && { textAlign: 'right' }]}>{dashboardT.recCompleted}</Text>
                </View>
              )}
              {(metrics?.averageOrderValue ?? 0) < 50 && (
                <View style={[styles.recRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[styles.recIcon, { backgroundColor: T.colors.accentDim }]}>
                    <Ionicons name="trending-up" size={16} color={T.colors.accent} />
                  </View>
                  <Text style={[styles.recText, isRTL && { textAlign: 'right' }]}>{dashboardT.recAvgOrder}</Text>
                </View>
              )}
              {(metrics?.todayCancelled ?? 0) <= (metrics?.yesterdayCancelled ?? 0) &&
               (metrics?.todayCompleted ?? 0) <= (metrics?.yesterdayCompleted ?? 0) &&
               (metrics?.averageOrderValue ?? 0) >= 50 && (
                <View style={[styles.recRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={[styles.recIcon, { backgroundColor: T.colors.accentDim }]}>
                    <Ionicons name="star" size={16} color={T.colors.accent} />
                  </View>
                  <Text style={[styles.recText, isRTL && { textAlign: 'right' }]}>{dashboardT.recSolid}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────
// Sub-component StyleSheet
// ─────────────────────────────────────────────
const sc = StyleSheet.create({
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.sp.sm,
    marginBottom: T.sp.md,
    marginTop: T.sp.sm,
  },
  sectionLabelIcon: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: T.colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabelText: {
    ...T.typo.sectionLabel,
    color: T.colors.gray2,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.md,
    padding: T.sp.md,
    borderWidth: 1,
    borderColor: T.colors.sep,
    overflow: 'hidden',
  },
  statAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
    borderTopLeftRadius: T.r.md,
    borderTopRightRadius: T.r.md,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: T.r.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: T.sp.xs,
    marginBottom: T.sp.sm,
  },
  statNum: {
    ...T.typo.kpiNum,
    fontSize: 22,
    color: T.colors.white,
    marginBottom: 2,
  },
  statLabel: {
    ...T.typo.micro,
    color: T.colors.gray2,
    textTransform: 'uppercase',
  },
  earningsCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    padding: T.sp.lg,
    borderTopWidth: 3,
    marginBottom: T.sp.md,
    borderWidth: 1,
    borderColor: T.colors.sep,
  },
  earningsHeader: { flexDirection: 'row', alignItems: 'center', gap: T.sp.sm, marginBottom: T.sp.lg },
  earningsIconWrap: { width: 28, height: 28, borderRadius: T.r.sm, justifyContent: 'center', alignItems: 'center' },
  earningsTitle: { ...T.typo.body, color: T.colors.gray1, fontWeight: '600' },
  earningsTotal: { flexDirection: 'row', alignItems: 'flex-end', gap: T.sp.sm, marginBottom: 2 },
  earningsTotalNum: { ...T.typo.heroNum, fontSize: 36, color: T.colors.white },
  earningsTotalCurrency: { ...T.typo.body, color: T.colors.gray2, marginBottom: 6 },
  earningsTotalLabel: { ...T.typo.micro, color: T.colors.gray3, marginBottom: T.sp.md },
  earningsProgress: {
    height: 5,
    backgroundColor: T.colors.sep,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: T.sp.md,
  },
  earningsProgressFees: { height: '100%', borderRadius: 3 },
  earningsProgressRevenue: { height: '100%', borderRadius: 3 },
  earningsBreakdown: { gap: T.sp.sm },
  earningsItem: { flexDirection: 'row', alignItems: 'center', gap: T.sp.sm },
  earningsDot: { width: 8, height: 8, borderRadius: 4 },
  earningsItemLabel: { ...T.typo.caption, color: T.colors.gray2, flex: 1 },
  earningsItemValue: { ...T.typo.caption, color: T.colors.gray1, fontWeight: '600' },
  statusCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    padding: T.sp.lg,
    borderTopWidth: 3,
    marginBottom: T.sp.md,
    borderWidth: 1,
    borderColor: T.colors.sep,
  },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: T.sp.sm, marginBottom: T.sp.lg },
  statusIconWrap: { width: 28, height: 28, borderRadius: T.r.sm, justifyContent: 'center', alignItems: 'center' },
  statusTitle: { ...T.typo.body, color: T.colors.gray1, fontWeight: '600' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: T.sp.md },
  statusItem: { width: '33%', alignItems: 'center', paddingVertical: T.sp.sm },
  statusNum: { ...T.typo.kpiNum, fontSize: 20, marginBottom: 2 },
  statusLbl: { ...T.typo.micro, color: T.colors.gray2 },
  completionWrap: { gap: T.sp.xs },
  completionTrack: { height: 5, backgroundColor: T.colors.sep, borderRadius: 3, overflow: 'hidden' },
  completionFill: { height: '100%', borderRadius: 3 },
  completionPct: { ...T.typo.micro, color: T.colors.gray3, textAlign: 'center' },
  weeklyMiniCard: {
    width: (width - 52) / 2,
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.md,
    padding: T.sp.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.colors.sep,
  },
  weeklyMiniIcon: { width: 30, height: 30, borderRadius: T.r.sm, justifyContent: 'center', alignItems: 'center', marginBottom: T.sp.sm },
  weeklyMiniVal: { ...T.typo.body, fontWeight: '700', marginBottom: 2 },
  weeklyMiniLbl: { ...T.typo.micro, color: T.colors.gray3, textAlign: 'center' },
});

// ─────────────────────────────────────────────
// Main StyleSheet
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.colors.bg },

  topBarGradient: {
    paddingHorizontal: T.sp.lg,
    paddingBottom: T.sp.lg,
    paddingTop: T.sp.sm,
    overflow: 'hidden',
  },
  topBar: {
    paddingHorizontal: T.sp.lg,
    paddingBottom: T.sp.lg,
    paddingTop: T.sp.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarEyebrow: { ...T.typo.sectionLabel, color: T.colors.accent, marginBottom: 2 },
  topBarTitle: { ...T.typo.title, color: T.colors.white },
  topBarDate: { ...T.typo.caption, color: T.colors.gray2, marginTop: 2 },
  topBarAccentLine: { height: 2, backgroundColor: T.colors.accent, marginTop: T.sp.md, borderRadius: 1, opacity: 0.6 },
  analysisBtn: {
    width: 42, height: 42, borderRadius: T.r.md,
    backgroundColor: T.colors.bgCardAlt,
    borderWidth: 1, borderColor: T.colors.sep,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingSpinner: {
    width: 42, height: 42, borderRadius: T.r.md,
    backgroundColor: T.colors.bgCardAlt,
    borderWidth: 1, borderColor: T.colors.accentBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtn: {
    width: 42, height: 42, borderRadius: T.r.md,
    backgroundColor: T.colors.bgCardAlt,
    borderWidth: 1, borderColor: T.colors.sep,
    justifyContent: 'center', alignItems: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: T.sp.lg, paddingBottom: T.sp.xxl },

  errorWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: T.sp.xxl },
  errorIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: T.colors.amberDim,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: T.sp.xl,
  },
  errorTitle: { ...T.typo.title, color: T.colors.white, marginBottom: T.sp.sm },
  errorBody: { ...T.typo.body, color: T.colors.gray2, textAlign: 'center', marginBottom: T.sp.xl },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: T.sp.sm,
    backgroundColor: T.colors.accent,
    paddingHorizontal: T.sp.xl, paddingVertical: T.sp.md,
    borderRadius: T.r.round,
    ...Platform.select({
      ios: { shadowColor: T.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  retryBtnText: { ...T.typo.body, color: T.colors.bg, fontWeight: '700' },

  heroCard: {
    borderRadius: T.r.xl,
    padding: T.sp.xl,
    marginBottom: T.sp.xl,
    borderWidth: 1,
    borderColor: T.colors.accentBorder,
    overflow: 'hidden',
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: T.sp.md },
  heroLabelChip: {
    flexDirection: 'row', alignItems: 'center', gap: T.sp.xs,
    backgroundColor: T.colors.accentDim,
    paddingHorizontal: T.sp.sm + 2, paddingVertical: T.sp.xs,
    borderRadius: T.r.round,
    borderWidth: 1, borderColor: T.colors.accentBorder,
  },
  heroLabelText: { ...T.typo.micro, color: T.colors.accent },
  heroTrend: {
    flexDirection: 'row', alignItems: 'center', gap: T.sp.xs,
    paddingHorizontal: T.sp.sm, paddingVertical: T.sp.xs,
    borderRadius: T.r.round,
  },
  heroTrendText: { ...T.typo.micro },
  heroNumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: T.sp.sm, marginBottom: T.sp.lg },
  heroNum: { ...T.typo.heroNum, color: T.colors.white },
  heroCurrency: { ...T.typo.body, color: T.colors.gray2, marginBottom: 8 },
  heroSubRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: T.colors.accentBorder,
    paddingTop: T.sp.md,
  },
  heroSubItem: { flex: 1, alignItems: 'center' },
  heroSubLabel: { ...T.typo.micro, color: T.colors.gray3, marginBottom: 3 },
  heroSubValue: { ...T.typo.body, color: T.colors.gray1, fontWeight: '700' },
  heroSubDivider: { width: 1, height: 32, backgroundColor: T.colors.accentBorder },

  heroSkeletonWrap: { alignItems: 'center', paddingVertical: T.sp.xl, marginBottom: T.sp.lg },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: T.sp.md, marginBottom: T.sp.xl },

  section: { marginBottom: T.sp.xl },

  compactCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    borderWidth: 1, borderColor: T.colors.sep,
    marginBottom: T.sp.xl,
    overflow: 'hidden',
  },
  compactGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: T.sp.lg, gap: 0 },
  compactItem: { width: '33.33%', alignItems: 'center', paddingVertical: T.sp.sm },
  compactNum: { ...T.typo.kpiNum, fontSize: 20, marginBottom: 2 },
  compactLbl: { ...T.typo.micro, color: T.colors.gray3 },
  compactEarningsRow: {
    flexDirection: 'row', alignItems: 'center', gap: T.sp.sm,
    paddingHorizontal: T.sp.lg, paddingVertical: T.sp.sm,
    borderTopWidth: 1, borderTopColor: T.colors.sep,
  },
  compactEarningsText: { ...T.typo.caption, color: T.colors.gray2 },
  compactEarningsVal: { ...T.typo.caption, color: T.colors.gray1, fontWeight: '700' },

  weeklyStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: T.sp.md, marginTop: T.sp.md },

  insightsCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    padding: T.sp.lg,
    borderWidth: 1, borderColor: T.colors.sep,
    marginBottom: T.sp.xl,
  },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: T.sp.md },
  insightIconWrap: { width: 36, height: 36, borderRadius: T.r.sm, justifyContent: 'center', alignItems: 'center' },
  insightText: { flex: 1 },
  insightLabel: { ...T.typo.micro, color: T.colors.gray3, marginBottom: 3 },
  insightValue: { ...T.typo.body, color: T.colors.gray1, fontWeight: '600' },
  insightSub: { ...T.typo.caption, color: T.colors.gray3, marginTop: 2 },
  insightDivider: { height: 1, backgroundColor: T.colors.sep, marginVertical: T.sp.md },

  chartCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    padding: T.sp.lg,
    marginBottom: T.sp.md,
    borderWidth: 1, borderColor: T.colors.sep,
  },
  chartTitle: { ...T.typo.body, color: T.colors.gray1, fontWeight: '600', marginBottom: T.sp.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: T.sp.sm, marginBottom: T.sp.sm },
  barLabel: { ...T.typo.caption, color: T.colors.gray2, width: 70 },
  barTrack: { flex: 1, height: 8, backgroundColor: T.colors.sep, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  barVal: { ...T.typo.caption, color: T.colors.gray1, fontWeight: '600', width: 52, textAlign: 'right' },
  chartInsight: { ...T.typo.caption, color: T.colors.gray3, textAlign: 'center', marginTop: T.sp.sm },

  efficiencyCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    padding: T.sp.lg,
    marginBottom: T.sp.xl,
    borderWidth: 1, borderColor: T.colors.sep,
  },
  efficiencyRow: { flexDirection: 'row', justifyContent: 'space-around' },
  efficiencyItem: { alignItems: 'center', flex: 1 },
  efficiencyIconWrap: { width: 44, height: 44, borderRadius: T.r.md, justifyContent: 'center', alignItems: 'center', marginBottom: T.sp.sm },
  efficiencyVal: { ...T.typo.body, fontWeight: '800', marginBottom: 2 },
  efficiencyLbl: { ...T.typo.micro, color: T.colors.gray3, textAlign: 'center' },

  weeklySummaryCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    padding: T.sp.lg,
    marginBottom: T.sp.xl,
    borderWidth: 1, borderColor: T.colors.sep,
  },
  weeklySummaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: T.sp.lg },
  weeklySummaryItem: { alignItems: 'center' },
  weeklySummaryNum: { ...T.typo.kpiNum, color: T.colors.white, marginBottom: 4 },
  weeklySummaryLbl: { ...T.typo.micro, color: T.colors.gray2 },
  weeklySummaryDetails: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: T.colors.sep,
    paddingTop: T.sp.md, marginBottom: T.sp.lg,
    paddingHorizontal: T.sp.sm,
  },
  weeklySummaryDetailItem: { alignItems: 'center' },
  weeklySummaryDetailLbl: { ...T.typo.micro, color: T.colors.gray3, marginBottom: 3 },
  weeklySummaryDetailVal: { ...T.typo.body, color: T.colors.gray1, fontWeight: '600' },
  weeklyEarningsBanner: {
    flexDirection: 'row', alignItems: 'center', gap: T.sp.sm,
    justifyContent: 'center',
    borderTopWidth: 1, borderTopColor: T.colors.sep,
    paddingTop: T.sp.md,
  },
  weeklyEarningsBig: { ...T.typo.title, color: T.colors.white },
  weeklyEarningsCaption: { ...T.typo.caption, color: T.colors.gray3 },

  recsCard: {
    backgroundColor: T.colors.bgCard,
    borderRadius: T.r.lg,
    padding: T.sp.lg,
    marginBottom: T.sp.xl,
    borderWidth: 1, borderColor: T.colors.sep,
    gap: T.sp.md,
  },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: T.sp.md },
  recIcon: { width: 32, height: 32, borderRadius: T.r.sm, justifyContent: 'center', alignItems: 'center' },
  recText: { ...T.typo.body, color: T.colors.gray1, flex: 1, lineHeight: 20 },
});

export default DashboardScreen;