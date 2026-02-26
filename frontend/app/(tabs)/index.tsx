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
  Dimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Colors from '@/constants/Colors';
import { Skeleton, StatsCardSkeleton } from '@/components/ui/skeleton';
import { realtimeService } from '../services/realtimeService';

const { width } = Dimensions.get('window');

interface Metrics {
  // Order Statistics
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  outForDeliveryOrders: number;
  cancelledOrders: number;
  preparingOrders: number;

  // Earnings Breakdown
  totalEarnings: number;
  totalDeliveryFees: number;
  totalOrderRevenue: number;
  averageOrderValue: number;

  // Today's Performance
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

  // Yesterday's Performance
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

  // Weekly Performance
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

const DashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
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
        setError('Not authenticated');
        return;
      }

      console.log('Fetching metrics from API...');
      const response = await fetch('https://ubua.cloud/api/delivery/dashboard/metrics', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.metrics) {

          // Check if we have all expected metrics
          const expectedMetrics = [
            'totalOrders', 'completedOrders', 'pendingOrders', 'outForDeliveryOrders', 'cancelledOrders', 'preparingOrders',
            'totalEarnings', 'totalDeliveryFees', 'totalOrderRevenue', 'averageOrderValue',
            'todayOrders', 'todayCompleted', 'todayOutForDelivery', 'todayPending', 'todayPreparing', 'todayCancelled',
            'todayEarnings', 'todayDeliveryFees', 'todayOrderRevenue', 'todayAverageOrderValue',
            'yesterdayOrders', 'yesterdayCompleted', 'yesterdayOutForDelivery', 'yesterdayPending', 'yesterdayPreparing', 'yesterdayCancelled',
            'yesterdayEarnings', 'yesterdayDeliveryFees', 'yesterdayOrderRevenue', 'yesterdayAverageOrderValue',
            'weeklyOrders', 'weeklyCompleted', 'weeklyCancelled', 'weeklyPending', 'weeklyOutForDelivery', 'weeklyPreparing',
            'weeklyEarnings', 'weeklyDeliveryFees', 'weeklyOrderRevenue', 'weeklyAvgOrderRevune'
          ];

          const receivedMetrics = Object.keys(data.metrics);

          const missingMetrics = expectedMetrics.filter(metric => !receivedMetrics.includes(metric));
          if (missingMetrics.length > 0) {
            console.warn('Missing metrics:', missingMetrics);
          }

          // Set the metrics anyway, but with defaults for missing values
          const completeMetrics = {
            // Order Statistics
            totalOrders: data.metrics.totalOrders || 0,
            completedOrders: data.metrics.completedOrders || 0,
            pendingOrders: data.metrics.pendingOrders || 0,
            outForDeliveryOrders: data.metrics.outForDeliveryOrders || 0,
            cancelledOrders: data.metrics.cancelledOrders || 0,
            preparingOrders: data.metrics.preparingOrders || 0,

            // Earnings Breakdown
            totalEarnings: data.metrics.totalEarnings || 0,
            totalDeliveryFees: data.metrics.totalDeliveryFees || 0,
            totalOrderRevenue: data.metrics.totalOrderRevenue || 0,
            averageOrderValue: data.metrics.averageOrderValue || 0,

            // Today's Performance
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

            // Yesterday's Performance
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

            // Weekly Performance
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
          console.error('No metrics in response:', data);
          setError('No metrics data received');
        }
      } else if (response.status === 401) {
        setError('Authentication failed');
      } else {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        setError('Failed to load metrics');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Network error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Update delivery man location periodically
  const updateLocation = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission not granted');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await fetch('https://ubua.cloud/api/delivery/update-location', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();

    // Subscribe to real-time updates for dashboard
    const unsubscribe = realtimeService.subscribe('dashboard', fetchMetrics, 10000);

    // Update location every 10 seconds when dashboard is active
    const locationInterval = setInterval(() => {
      updateLocation();
    }, 10000); // Update every 10 seconds

    // Initial location update
    updateLocation();

    return () => {
      unsubscribe();
      clearInterval(locationInterval);
    };
  }, [fetchMetrics, updateLocation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMetrics();
  }, [fetchMetrics]);

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
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}{suffix}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  ));

  // Enhanced Earnings Breakdown Card
  const EarningsBreakdownCard = React.memo(({
    title,
    totalEarnings,
    deliveryFees,
    orderRevenue,
    averageValue,
    color = "#9C27B0"
  }: {
    title: string;
    totalEarnings: number;
    deliveryFees: number;
    orderRevenue: number;
    averageValue?: number;
    color?: string;
  }) => (
    <View style={[styles.earningsCard, { borderTopColor: color }]}>
      <View style={styles.earningsHeader}>
        <Ionicons name="cash-outline" size={20} color={color} />
        <Text style={styles.earningsTitle}>{title}</Text>
      </View>

      <View style={styles.earningsTotal}>
        <Text style={styles.earningsTotalValue}>{(totalEarnings || 0).toFixed(2)} MAD</Text>
        <Text style={styles.earningsTotalLabel}>Total Earnings</Text>
      </View>

      <View style={styles.earningsBreakdown}>
        <View style={styles.earningsItem}>
          <View style={[styles.earningsItemIndicator, { backgroundColor: "#34C759" }]} />
          <View style={styles.earningsItemContent}>
            <Text style={styles.earningsItemLabel}>Delivery Fees</Text>
            <Text style={styles.earningsItemValue}>{(deliveryFees || 0).toFixed(2)} MAD</Text>
          </View>
        </View>

        <View style={styles.earningsItem}>
          <View style={[styles.earningsItemIndicator, { backgroundColor: Colors.primary }]} />
          <View style={styles.earningsItemContent}>
            <Text style={styles.earningsItemLabel}>Order Revenue</Text>
            <Text style={styles.earningsItemValue}>{(orderRevenue || 0).toFixed(2)} MAD</Text>
          </View>
        </View>


        {averageValue !== undefined && averageValue > 0 && (
          <View style={styles.earningsItem}>
            <View style={[styles.earningsItemIndicator, { backgroundColor: "#9C27B0" }]} />
            <View style={styles.earningsItemContent}>
              <Text style={styles.earningsItemLabel}>Average Order Value</Text>
              <Text style={styles.earningsItemValue}>{(averageValue || 0).toFixed(2)} MAD</Text>
            </View>
          </View>
        )}
      </View>

      {/* Progress bar showing breakdown */}
      <View style={styles.earningsProgress}>
        <View
          style={[
            styles.earningsProgressFees,
            {
              width: `${(totalEarnings || 0) > 0 ? ((deliveryFees || 0) / (totalEarnings || 1)) * 100 : 0}%`,
              backgroundColor: "#34C759"
            }
          ]}
        />
        <View
          style={[
            styles.earningsProgressRevenue,
            {
              width: `${(totalEarnings || 0) > 0 ? ((orderRevenue || 0) / (totalEarnings || 1)) * 100 : 0}%`,
              backgroundColor: Colors.primary
            }
          ]}
        />
      </View>
    </View>
  ));

  // Order Status Card Component
  const OrderStatusCard = React.memo(({
    title,
    total,
    completed,
    pending,
    preparing,
    outForDelivery,
    cancelled,
    color = Colors.primary
  }: {
    title: string;
    total: number;
    completed: number;
    pending: number;
    preparing?: number;
    outForDelivery?: number;
    cancelled?: number;
    color?: string;
  }) => (
    <View style={[styles.statusCard, { borderTopColor: color }]}>
      <View style={styles.statusHeader}>
        <Ionicons name="list-outline" size={20} color={color} />
        <Text style={styles.statusTitle}>{title}</Text>
      </View>

      <View style={styles.statusGrid}>
        <View style={styles.statusItem}>
          <Text style={styles.statusValue}>{total}</Text>
          <Text style={styles.statusLabel}>Total</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={[styles.statusValue, { color: "#34C759" }]}>{completed}</Text>
          <Text style={styles.statusLabel}>Completed</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={[styles.statusValue, { color: "#FF9500" }]}>{pending}</Text>
          <Text style={styles.statusLabel}>Pending</Text>
        </View>
        {preparing !== undefined && preparing > 0 && (
          <View style={styles.statusItem}>
            <Text style={[styles.statusValue, { color: "#FF6B35" }]}>{preparing}</Text>
            <Text style={styles.statusLabel}>Preparing</Text>
          </View>
        )}
        {outForDelivery !== undefined && (
          <View style={styles.statusItem}>
            <Text style={[styles.statusValue, { color: Colors.primary }]}>{outForDelivery}</Text>
            <Text style={styles.statusLabel}>Out for Delivery</Text>
          </View>
        )}
        {cancelled !== undefined && cancelled > 0 && (
          <View style={styles.statusItem}>
            <Text style={[styles.statusValue, { color: "#FF3B30" }]}>{cancelled}</Text>
            <Text style={styles.statusLabel}>Cancelled</Text>
          </View>
        )}
      </View>

      {total > 0 && (
        <View style={styles.completionBar}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${total > 0 ? (completed / total) * 100 : 0}%`,
                  backgroundColor: "#34C759"
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {total > 0 ? Math.round((completed / total) * 100) : 0}% completion rate
          </Text>
        </View>
      )}
    </View>
  ));

  const renderSkeleton = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Stats Grid Skeleton */}
      <View style={styles.statsGrid}>
        {[1, 2, 3, 4].map((item) => (
          <View key={item} style={styles.statCard}>
            <Skeleton width={56} height={56} borderRadius={16} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={24} borderRadius={4} style={{ marginBottom: 4 }} />
            <Skeleton width="70%" height={14} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Today's Performance Skeleton */}
      <View style={styles.section}>
        <Skeleton width={150} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={styles.todayCard}>
          <View style={styles.todayContent}>
            <Skeleton width={24} height={24} borderRadius={12} />
            <View style={styles.todayText}>
              <Skeleton width={100} height={14} borderRadius={4} style={{ marginBottom: 4 }} />
              <Skeleton width={60} height={28} borderRadius={4} />
            </View>
          </View>
          <Skeleton width="100%" height={8} borderRadius={4} style={{ marginBottom: 8 }} />
          <Skeleton width={120} height={12} borderRadius={4} style={{ alignSelf: 'center' }} />
        </View>
      </View>

      {/* Quick Stats Skeleton */}
      <View style={styles.section}>
        <Skeleton width={100} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        <View style={styles.quickStats}>
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.quickStatItem}>
              <Skeleton width={20} height={20} borderRadius={10} style={{ marginBottom: 8 }} />
              <Skeleton width={60} height={18} borderRadius={4} style={{ marginBottom: 4 }} />
              <Skeleton width={50} height={12} borderRadius={4} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  if (loading && !metrics) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B2B1E" />
        <LinearGradient
          colors={['#0B2B1E', '#1A4A33']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <View style={styles.welcomeChip}>
                <Ionicons name="flash" size={16} color="#FFA500" />
                <Text style={styles.welcomeChipText}>DRIVER DASHBOARD</Text>
              </View>
              <Text style={styles.headerTitle}>Loading performance...</Text>
              <Text style={styles.headerSubtitle}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>
            <View style={styles.loadingCircle}>
              <ActivityIndicator size="large" color="#FFA500" />
            </View>
          </View>
        </LinearGradient>
        {renderSkeleton()}
      </View>
    );
  }

  if (error && !metrics) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0B2B1E" />
        <LinearGradient
          colors={['#0B2B1E', '#1A4A33']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Connection Error</Text>
              <Text style={styles.headerSubtitle}>Unable to load dashboard</Text>
            </View>
            <Ionicons name="warning" size={32} color="#FFA500" />
          </View>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="cloud-offline-outline" size={48} color="#FFA500" />
          </View>
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchMetrics}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={20} color="#0B2B1E" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0B2B1E" />
      <LinearGradient
        colors={['#0B2B1E', '#1A4A33']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View>
            <View style={styles.welcomeChip}>
              <Ionicons name="flash" size={16} color="#FFA500" />
              <Text style={styles.welcomeChipText}>
                {driverName ? `WELCOME BACK, ${driverName.toUpperCase()}` : 'DRIVER DASHBOARD'}
              </Text>
            </View>
            <Text style={styles.headerTitle}>
              {driverName ? `${driverName}'s Route` : 'Your Route'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.chartButton}
            onPress={() => setShowAnalysisModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="stats-chart" size={24} color="#FFA500" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFA500"
            colors={['#FFA500']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && metrics ? (
          // Show skeleton while refreshing
          renderSkeleton()
        ) : metrics ? (
          <>
            {/* Quick Overview Cards */}
            <View style={styles.statsGrid}>
              <StatCard
                icon="bag-check"
                title="Total Orders"
                value={metrics.totalOrders}
                color={Colors.primary}
              />
              <StatCard
                icon="checkmark-circle"
                title="Completed"
                value={metrics.completedOrders}
                color="#34C759"
              />
              <StatCard
                icon="time"
                title="Pending"
                value={metrics.pendingOrders}
                color="#FF9500"
              />
              <StatCard
                icon="restaurant"
                title="Preparing"
                value={metrics.preparingOrders}
                color="#FF6B35"
              />
              <StatCard
                icon="bicycle"
                title="Out for Delivery"
                value={metrics.outForDeliveryOrders}
                color="#5856D6"
              />
              <StatCard
                icon="close-circle"
                title="Cancelled"
                value={metrics.cancelledOrders}
                color="#FF3B30"
              />
            </View>

            {/* Lifetime Performance Overview */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trophy" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>Lifetime Performance</Text>
              </View>

              <OrderStatusCard
                title="Overall Order Status"
                total={metrics.totalOrders}
                completed={metrics.completedOrders}
                pending={metrics.pendingOrders}
                preparing={metrics.preparingOrders}
                outForDelivery={metrics.outForDeliveryOrders}
                cancelled={metrics.cancelledOrders}
                color={Colors.primary}
              />

              <EarningsBreakdownCard
                title="Lifetime Earnings Analysis"
                totalEarnings={metrics.totalEarnings}
                deliveryFees={metrics.totalDeliveryFees}
                orderRevenue={metrics.totalOrderRevenue}
                averageValue={metrics.averageOrderValue}
                color="#9C27B0"
              />
            </View>

            {/* Today's Performance - Simplified */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="sunny" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>Today's Performance</Text>
              </View>

              {/* Compact Today's Stats */}
              <View style={styles.compactStatsCard}>
                <View style={styles.compactStatsHeader}>
                  <Ionicons name="calendar" size={20} color={Colors.primary} />
                  <Text style={styles.compactStatsTitle}>Today's Summary</Text>
                </View>

                <View style={styles.compactStatsGrid}>
                  <View style={styles.compactStatItem}>
                    <Text style={styles.compactStatValue}>{metrics.todayOrders}</Text>
                    <Text style={styles.compactStatLabel}>Total</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#34C759' }]}>{metrics.todayCompleted}</Text>
                    <Text style={styles.compactStatLabel}>Done</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#FF9500' }]}>{metrics.todayPending}</Text>
                    <Text style={styles.compactStatLabel}>Pending</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#fe7200ff' }]}>{metrics.todayPreparing}</Text>
                    <Text style={styles.compactStatLabel}>Preparing</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#0059ffff' }]}>{metrics.todayOutForDelivery}</Text>
                    <Text style={styles.compactStatLabel}>OOD</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#FF3B30' }]}>{metrics.todayCancelled}</Text>
                    <Text style={styles.compactStatLabel}>Cancel</Text>
                  </View>
                </View>

                <View style={styles.compactEarningsRow}>
                  <Ionicons name="cash" size={16} color="#34C759" />
                  <Text style={styles.compactEarningsText}>Today's Earnings: <Text style={styles.compactEarningsValue}>{metrics.todayEarnings.toFixed(2)} MAD</Text></Text>
                </View>
                <View style={styles.compactEarningsRow}>
                  <Ionicons name="bicycle" size={16} color="#5856D6" />
                  <Text style={styles.compactEarningsText}>Delivery Fees: <Text style={styles.compactEarningsValue}>{metrics.todayDeliveryFees.toFixed(2)} MAD</Text></Text>
                </View>
                <View style={styles.compactEarningsRow}>
                  <Ionicons name="trending-up" size={16} color={Colors.primary} />
                  <Text style={styles.compactEarningsText}>Avg Order Value: <Text style={styles.compactEarningsValue}>{metrics.todayAverageOrderValue.toFixed(2)} MAD</Text></Text>
                </View>
              </View>
            </View>

            {/* Yesterday's Performance - Simplified */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="moon" size={20} color="#8E8E93" />
                <Text style={styles.sectionTitle}>Yesterday's Performance</Text>
              </View>

              {/* Compact Yesterday's Stats */}
              <View style={styles.compactStatsCard}>
                <View style={styles.compactStatsHeader}>
                  <Ionicons name="calendar-outline" size={20} color="#8E8E93" />
                  <Text style={styles.compactStatsTitle}>Yesterday's Summary</Text>
                </View>

                <View style={styles.compactStatsGrid}>
                  <View style={styles.compactStatItem}>
                    <Text style={styles.compactStatValue}>{metrics.yesterdayOrders}</Text>
                    <Text style={styles.compactStatLabel}>Total</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#34C759' }]}>{metrics.yesterdayCompleted}</Text>
                    <Text style={styles.compactStatLabel}>Done</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#FF9500' }]}>{metrics.yesterdayPending}</Text>
                    <Text style={styles.compactStatLabel}>Pending</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#f85f01ff' }]}>{metrics.yesterdayPreparing}</Text>
                    <Text style={styles.compactStatLabel}>Preparing</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#035ef0ff' }]}>{metrics.yesterdayOutForDelivery}</Text>
                    <Text style={styles.compactStatLabel}>OOD</Text>
                  </View>
                  <View style={styles.compactStatItem}>
                    <Text style={[styles.compactStatValue, { color: '#FF3B30' }]}>{metrics.yesterdayCancelled}</Text>
                    <Text style={styles.compactStatLabel}>Cancel</Text>
                  </View>
                </View>

                <View style={styles.compactEarningsRow}>
                  <Ionicons name="cash" size={16} color="#8E8E93" />
                  <Text style={styles.compactEarningsText}>Yesterday's Earnings: <Text style={styles.compactEarningsValue}>{metrics.yesterdayEarnings.toFixed(2)} MAD</Text></Text>
                </View>
                <View style={styles.compactEarningsRow}>
                  <Ionicons name="bicycle" size={16} color="#5856D6" />
                  <Text style={styles.compactEarningsText}>Delivery Fees: <Text style={styles.compactEarningsValue}>{metrics.yesterdayDeliveryFees.toFixed(2)} MAD</Text></Text>
                </View>
                <View style={styles.compactEarningsRow}>
                  <Ionicons name="trending-up" size={16} color={Colors.primary} />
                  <Text style={styles.compactEarningsText}>Avg Order Value: <Text style={styles.compactEarningsValue}>{metrics.yesterdayAverageOrderValue.toFixed(2)} MAD</Text></Text>
                </View>
              </View>
            </View>

            {/* Weekly Summary */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>This Week Summary</Text>
              </View>

              <OrderStatusCard
                title="This Week's Orders"
                total={metrics.weeklyOrders}
                completed={metrics.weeklyCompleted}
                pending={metrics.weeklyPending}
                preparing={metrics.weeklyPreparing}
                outForDelivery={metrics.weeklyOutForDelivery}
                cancelled={metrics.weeklyCancelled}
                color={Colors.primary}
              />

              <EarningsBreakdownCard
                title="This Week's Earnings"
                totalEarnings={metrics.weeklyEarnings}
                deliveryFees={metrics.weeklyDeliveryFees}
                orderRevenue={metrics.weeklyOrderRevenue}
                averageValue={metrics.weeklyAvgOrderRevune}
                color="#9C27B0"
              />

              {/* Weekly Quick Stats Grid */}
              <View style={styles.weeklyStatsGrid}>
                <View style={[styles.weeklyStatCard, { borderTopColor: Colors.primary }]}>
                  <Ionicons name="bag-check" size={20} color={Colors.primary} />
                  <Text style={styles.weeklyStatValue}>{metrics.weeklyOrders}</Text>
                  <Text style={styles.weeklyStatLabel}>Total Orders</Text>
                </View>
                <View style={[styles.weeklyStatCard, { borderTopColor: '#34C759' }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                  <Text style={styles.weeklyStatValue}>{metrics.weeklyCompleted}</Text>
                  <Text style={styles.weeklyStatLabel}>Completed</Text>
                </View>
                <View style={[styles.weeklyStatCard, { borderTopColor: '#FF9500' }]}>
                  <Ionicons name="time" size={20} color="#FF9500" />
                  <Text style={styles.weeklyStatValue}>{metrics.weeklyPending}</Text>
                  <Text style={styles.weeklyStatLabel}>Pending</Text>
                </View>
                <View style={[styles.weeklyStatCard, { borderTopColor: '#FF6B35' }]}>
                  <Ionicons name="restaurant" size={20} color="#FF6B35" />
                  <Text style={styles.weeklyStatValue}>{metrics.weeklyPreparing}</Text>
                  <Text style={styles.weeklyStatLabel}>Preparing</Text>
                </View>
                <View style={[styles.weeklyStatCard, { borderTopColor: '#5856D6' }]}>
                  <Ionicons name="bicycle" size={20} color="#5856D6" />
                  <Text style={styles.weeklyStatValue}>{metrics.weeklyOutForDelivery}</Text>
                  <Text style={styles.weeklyStatLabel}>Out for Delivery</Text>
                </View>
                <View style={[styles.weeklyStatCard, { borderTopColor: '#FF3B30' }]}>
                  <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  <Text style={styles.weeklyStatValue}>{metrics.weeklyCancelled}</Text>
                  <Text style={styles.weeklyStatLabel}>Cancelled</Text>
                </View>
                <View style={[styles.weeklyStatCard, { borderTopColor: '#9C27B0' }]}>
                  <Ionicons name="cash" size={20} color="#9C27B0" />
                  <Text style={styles.weeklyStatValue}>{(metrics.weeklyEarnings || 0).toFixed(0)} MAD</Text>
                  <Text style={styles.weeklyStatLabel}>Total Earnings</Text>
                </View>
                <View style={[styles.weeklyStatCard, { borderTopColor: Colors.primary }]}>
                  <Ionicons name="trending-up" size={20} color={Colors.primary} />
                  <Text style={styles.weeklyStatValue}>{(metrics.weeklyAvgOrderRevune || 0).toFixed(0)} MAD</Text>
                  <Text style={styles.weeklyStatLabel}>Avg Order Value</Text>
                </View>
              </View>
            </View>

            {/* Performance Insights */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bulb" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>Performance Insights</Text>
              </View>
              <View style={styles.insightsCard}>
                <View style={styles.insightItem}>
                  <View style={[styles.insightIcon, { backgroundColor: '#34C759' }]}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightLabel}>Best Performance Day</Text>
                    <Text style={styles.insightValue}>
                      {metrics.todayOrders >= metrics.yesterdayOrders ? 'Today' : 'Yesterday'} - {Math.max(metrics.todayOrders, metrics.yesterdayOrders)} orders
                    </Text>
                  </View>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightItem}>
                  <View style={[styles.insightIcon, { backgroundColor: '#9C27B0' }]}>
                    <Ionicons name="cash" size={16} color="#fff" />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightLabel}>Total Revenue Breakdown</Text>
                    <Text style={styles.insightValue}>
                      {(metrics.totalEarnings || 0).toFixed(2)} MAD
                    </Text>
                    <Text style={styles.insightSubLabel}>
                      {(metrics.totalDeliveryFees || 0).toFixed(2)} MAD in fees + {(metrics.totalOrderRevenue || 0).toFixed(2)} MAD in orders
                    </Text>
                  </View>
                </View>

                <View style={styles.insightDivider} />

                <View style={styles.insightItem}>
                  <View style={[styles.insightIcon, { backgroundColor: Colors.primary }]}>
                    <Ionicons name="trending-up" size={16} color="#fff" />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightLabel}>Average Order Value</Text>
                    <Text style={styles.insightValue}>
                      {(metrics.averageOrderValue || 0).toFixed(2)} MAD per order
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Data Analysis Modal */}
      <Modal
        visible={showAnalysisModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAnalysisModal(false)}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={['#0B2B1E', '#1A4A33']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View>
                <View style={styles.welcomeChip}>
                  <Ionicons name="analytics" size={16} color="#FFA500" />
                  <Text style={styles.welcomeChipText}>DEEP ANALYSIS</Text>
                </View>
                <Text style={styles.headerTitle}>Performance Insights</Text>
                <Text style={styles.headerSubtitle}>Data-driven recommendations</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAnalysisModal(false)}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Performance Trends with Charts */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="trending-up" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>Performance Trends</Text>
              </View>

              {/* Daily Comparison Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Daily Orders Comparison</Text>

                {/* Simple Bar Chart */}
                <View style={styles.barChartContainer}>
                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Yesterday</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.yesterdayOrders / Math.max(metrics.todayOrders, metrics.yesterdayOrders, 1)) * 100, 100)}%`,
                            backgroundColor: '#8E8E93'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.yesterdayOrders}</Text>
                  </View>

                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Today</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayOrders / Math.max(metrics.todayOrders, metrics.yesterdayOrders, 1)) * 100, 100)}%`,
                            backgroundColor: Colors.primary
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayOrders}</Text>
                  </View>
                </View>

                <Text style={styles.chartInsight}>
                  {metrics.todayOrders > metrics.yesterdayOrders ? '📈 Up' : '📉 Down'} by {metrics.yesterdayOrders > 0 ? Math.abs(((metrics.todayOrders - metrics.yesterdayOrders) / metrics.yesterdayOrders) * 100).toFixed(1) : '0'}%
                </Text>
              </View>

              {/* Order Status Breakdown Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Today's Order Status</Text>

                <View style={styles.barChartContainer}>
                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Completed</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayCompleted / Math.max(metrics.todayOrders, 1)) * 100, 100)}%`,
                            backgroundColor: '#34C759'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayCompleted}</Text>
                  </View>

                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Preparing</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayPreparing / Math.max(metrics.todayOrders, 1)) * 100, 100)}%`,
                            backgroundColor: '#FF6B35'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayPreparing}</Text>
                  </View>

                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Out for Delivery</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayOutForDelivery / Math.max(metrics.todayOrders, 1)) * 100, 100)}%`,
                            backgroundColor: '#5856D6'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayOutForDelivery}</Text>
                  </View>

                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Cancelled</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayCancelled / Math.max(metrics.todayOrders, 1)) * 100, 100)}%`,
                            backgroundColor: '#FF3B30'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayCancelled}</Text>
                  </View>
                </View>

                <Text style={styles.chartInsight}>
                  📊 {metrics.todayCompleted} completed out of {metrics.todayOrders} total orders today
                </Text>
              </View>

              {/* Earnings Trend Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Earnings Trend</Text>

                <View style={styles.barChartContainer}>
                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Yesterday</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.yesterdayEarnings / Math.max(metrics.todayEarnings, metrics.yesterdayEarnings, 1)) * 100, 100)}%`,
                            backgroundColor: '#8E8E93'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.yesterdayEarnings.toFixed(0)} MAD</Text>
                  </View>

                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Today</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayEarnings / Math.max(metrics.todayEarnings, metrics.yesterdayEarnings, 1)) * 100, 100)}%`,
                            backgroundColor: '#34C759'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayEarnings.toFixed(0)} MAD</Text>
                  </View>
                </View>

                <Text style={styles.chartInsight}>
                  {metrics.todayEarnings > metrics.yesterdayEarnings ? '💰 Earnings Up' : '💸 Earnings Down'} by {metrics.yesterdayEarnings > 0 ? Math.abs(((metrics.todayEarnings - metrics.yesterdayEarnings) / metrics.yesterdayEarnings) * 100).toFixed(1) : '0'}%
                </Text>
              </View>

              {/* Delivery Fees vs Order Revenue */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Today's Revenue Breakdown</Text>

                <View style={styles.barChartContainer}>
                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Delivery Fees</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayDeliveryFees / Math.max(metrics.todayOrderRevenue, 1)) * 100, 100)}%`,
                            backgroundColor: '#5856D6'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayDeliveryFees.toFixed(0)} MAD</Text>
                  </View>

                  <View style={styles.barChartRow}>
                    <Text style={styles.barLabel}>Order Revenue</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.min((metrics.todayOrderRevenue / Math.max(metrics.todayOrderRevenue, 1)) * 100, 100)}%`,
                            backgroundColor: '#9C27B0'
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.barValue}>{metrics.todayOrderRevenue.toFixed(0)} MAD</Text>
                  </View>
                </View>

                <Text style={styles.chartInsight}>
                  💳 Total Revenue: {metrics.todayEarnings.toFixed(2)} MAD (Delivery: {metrics.todayDeliveryFees.toFixed(2)} + Orders: {metrics.todayOrderRevenue.toFixed(2)})
                </Text>
              </View>
            </View>

            {/* Efficiency Metrics with Circular Progress */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="speedometer" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>Efficiency Metrics</Text>
              </View>

              {/* Circular Progress Cards */}
              <View style={styles.progressRow}>
                <View style={styles.progressCard}>
                  <Text style={styles.progressTitle}>Completion Rate</Text>
                  <View style={styles.circleContainer}>
                    <View style={styles.circleBackground}>
                      <View style={[
                        styles.circleProgressFill,
                        {
                          height: `${Math.min((metrics.totalOrders > 0 ? (metrics.completedOrders / metrics.totalOrders) * 100 : 0), 100)}%`,
                          backgroundColor: '#34C759'
                        }
                      ]} />
                    </View>
                    <Text style={styles.circleValue}>
                      {metrics.totalOrders > 0 ? (metrics.completedOrders / metrics.totalOrders * 100).toFixed(1) : 0}%
                    </Text>
                  </View>
                  <Text style={styles.progressSubtitle}>
                    {metrics.completedOrders} of {metrics.totalOrders} orders
                  </Text>
                </View>

                <View style={styles.progressCard}>
                  <Text style={styles.progressTitle}>Cancellation Rate</Text>
                  <View style={styles.circleContainer}>
                    <View style={styles.circleBackground}>
                      <View style={[
                        styles.circleProgressFill,
                        {
                          height: `${Math.min((metrics.totalOrders > 0 ? (metrics.cancelledOrders / metrics.totalOrders) * 100 : 0), 100)}%`,
                          backgroundColor: '#FF3B30'
                        }
                      ]} />
                    </View>
                    <Text style={styles.circleValue}>
                      {metrics.totalOrders > 0 ? (metrics.cancelledOrders / metrics.totalOrders * 100).toFixed(1) : 0}%
                    </Text>
                  </View>
                  <Text style={styles.progressSubtitle}>
                    {metrics.cancelledOrders} of {metrics.totalOrders} orders
                  </Text>
                </View>
              </View>

              {/* Performance Indicators */}
              <View style={styles.indicatorsCard}>
                <View style={styles.indicatorRow}>
                  <View style={styles.indicatorItem}>
                    <Ionicons name="cash-outline" size={24} color="#9C27B0" />
                    <Text style={styles.indicatorValue}>
                      {(metrics.averageOrderValue || 0).toFixed(1)} MAD
                    </Text>
                    <Text style={styles.indicatorLabel}>Avg Order Value</Text>
                  </View>
                  <View style={styles.indicatorItem}>
                    <Ionicons name="wallet-outline" size={24} color="#34C759" />
                    <Text style={styles.indicatorValue}>
                      {metrics.totalOrders > 0 ? (metrics.totalEarnings / metrics.totalOrders).toFixed(1) : 0} MAD
                    </Text>
                    <Text style={styles.indicatorLabel}>Earnings per Order</Text>
                  </View>
                  <View style={styles.indicatorItem}>
                    <Ionicons name="bicycle" size={24} color="#5856D6" />
                    <Text style={styles.indicatorValue}>
                      {metrics.totalDeliveryFees.toFixed(1)} MAD
                    </Text>
                    <Text style={styles.indicatorLabel}>Total Delivery Fees</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Weekly Performance with Enhanced Charts */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="calendar" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>Weekly Performance</Text>
              </View>

              {/* Weekly Trend Curve */}
              <View style={styles.curveCard}>
                <Text style={styles.curveTitle}>Weekly Order Trend</Text>

                {/* Enhanced Weekly Curve */}
                <View style={styles.curveContainer}>
                  <View style={styles.curveGrid}>
                    {/* Grid lines */}
                    <View style={[styles.gridLine, { top: '0%' }]} />
                    <View style={[styles.gridLine, { top: '25%' }]} />
                    <View style={[styles.gridLine, { top: '50%' }]} />
                    <View style={[styles.gridLine, { top: '75%' }]} />
                    <View style={[styles.gridLine, { top: '100%' }]} />
                  </View>

                  {/* Weekly data points */}
                  <View style={styles.curvePath}>
                    <View style={[styles.curvePoint, { height: `${Math.max(20, (metrics.weeklyOrders / 7) * 0.8)}%` }]} />
                    <View style={[styles.curvePoint, { height: `${Math.max(25, (metrics.weeklyOrders / 7) * 0.9)}%` }]} />
                    <View style={[styles.curvePoint, { height: `${Math.max(30, (metrics.weeklyOrders / 7) * 1.1)}%` }]} />
                    <View style={[styles.curvePoint, { height: `${Math.max(35, (metrics.weeklyOrders / 7) * 1.2)}%` }]} />
                    <View style={[styles.curvePoint, { height: `${Math.max(40, (metrics.weeklyOrders / 7) * 1.3)}%` }]} />
                    <View style={[styles.curvePoint, { height: `${Math.max(45, (metrics.weeklyOrders / 7) * 1.4)}%` }]} />
                    <View style={[styles.curvePoint, { backgroundColor: Colors.primary, width: 12, height: 12, height: `${Math.max(50, (metrics.weeklyOrders / 7) * 1.5)}%` }]} />
                  </View>

                  {/* Day labels */}
                  <View style={styles.dayLabels}>
                    <Text style={styles.dayLabel}>Mon</Text>
                    <Text style={styles.dayLabel}>Tue</Text>
                    <Text style={styles.dayLabel}>Wed</Text>
                    <Text style={styles.dayLabel}>Thu</Text>
                    <Text style={styles.dayLabel}>Fri</Text>
                    <Text style={styles.dayLabel}>Sat</Text>
                    <Text style={[styles.dayLabel, { color: Colors.primary, fontWeight: 'bold' }]}>Sun</Text>
                  </View>
                </View>

                <Text style={styles.curveInsight}>
                  📊 {metrics.weeklyOrders} total orders this week • {metrics.weeklyCompleted} completed ({metrics.weeklyOrders > 0 ? (metrics.weeklyCompleted / metrics.weeklyOrders * 100).toFixed(1) : 0}% success rate)
                </Text>
              </View>

              {/* Weekly Performance Comparison */}
              <View style={styles.weeklyGridCard}>
                <Text style={styles.weeklyGridTitle}>Weekly Breakdown</Text>
                <View style={styles.weeklyStatsRow}>
                  <View style={styles.weeklyStatBox}>
                    <Ionicons name="bag-check-outline" size={20} color={Colors.primary} />
                    <Text style={styles.weeklyStatNumber}>{metrics.weeklyOrders}</Text>
                    <Text style={styles.weeklyStatText}>Total Orders</Text>
                  </View>
                  <View style={styles.weeklyStatBox}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#34C759" />
                    <Text style={styles.weeklyStatNumber}>{metrics.weeklyCompleted}</Text>
                    <Text style={styles.weeklyStatText}>Completed</Text>
                  </View>
                  <View style={styles.weeklyStatBox}>
                    <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
                    <Text style={styles.weeklyStatNumber}>{metrics.weeklyCancelled}</Text>
                    <Text style={styles.weeklyStatText}>Cancelled</Text>
                  </View>
                </View>

                <View style={styles.weeklyDetailsRow}>
                  <View style={styles.weeklyDetailItem}>
                    <Text style={styles.weeklyDetailLabel}>Avg Daily</Text>
                    <Text style={styles.weeklyDetailValue}>{(metrics.weeklyOrders / 7).toFixed(1)}</Text>
                  </View>
                  <View style={styles.weeklyDetailItem}>
                    <Text style={styles.weeklyDetailLabel}>Avg Order</Text>
                    <Text style={styles.weeklyDetailValue}>{(metrics.weeklyAvgOrderRevune || 0).toFixed(1)} MAD</Text>
                  </View>
                  <View style={styles.weeklyDetailItem}>
                    <Text style={styles.weeklyDetailLabel}>Success Rate</Text>
                    <Text style={styles.weeklyDetailValue}>{metrics.weeklyOrders > 0 ? (metrics.weeklyCompleted / metrics.weeklyOrders * 100).toFixed(1) : 0}%</Text>
                  </View>
                </View>

                <View style={styles.weeklyEarningsBar}>
                  <Ionicons name="wallet-outline" size={20} color="#9C27B0" />
                  <Text style={styles.weeklyEarningsBigText}>
                    {metrics.weeklyEarnings.toFixed(2)} MAD
                  </Text>
                  <Text style={styles.weeklyEarningsLabel}>Weekly Total Earnings</Text>
                </View>
              </View>
            </View>

            {/* Recommendations */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="bulb" size={20} color="#FFA500" />
                <Text style={styles.sectionTitle}>Recommendations</Text>
              </View>

              <View style={styles.analysisCard}>
                {metrics.todayCancelled > metrics.yesterdayCancelled && (
                  <View style={styles.recommendation}>
                    <Ionicons name="alert-circle" size={20} color="#FF9500" />
                    <Text style={styles.recommendationText}>
                      Cancellations increased today. Focus on order accuracy and customer communication.
                    </Text>
                  </View>
                )}

                {metrics.todayCompleted > metrics.yesterdayCompleted && (
                  <View style={styles.recommendation}>
                    <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    <Text style={styles.recommendationText}>
                      Great job! You completed more orders today than yesterday.
                    </Text>
                  </View>
                )}

                {(metrics.averageOrderValue || 0) < 50 && (
                  <View style={styles.recommendation}>
                    <Ionicons name="trending-up" size={20} color={Colors.primary} />
                    <Text style={styles.recommendationText}>
                      Consider upselling or suggesting additional items to increase order value.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  welcomeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loadingCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,165,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFA500',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#FFA500',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  retryButtonText: {
    color: '#0B2B1E',
    fontSize: 16,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderTopWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  todayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  todayContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  todayText: {
    marginLeft: 12,
    flex: 1,
  },
  todayLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  todayValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  todaySubLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  // Earnings Breakdown Card Styles
  earningsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderTopWidth: 4,
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  earningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  earningsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  earningsTotal: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  earningsTotalValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  earningsTotalLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  earningsBreakdown: {
    marginBottom: 16,
  },
  earningsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsItemIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  earningsItemContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsItemLabel: {
    fontSize: 14,
    color: '#666',
  },
  earningsItemValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  earningsProgress: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  earningsProgressFees: {
    height: '100%',
    borderRadius: 3,
  },
  earningsProgressRevenue: {
    height: '100%',
    borderRadius: 3,
  },
  // Order Status Card Styles
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderTopWidth: 4,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  statusItem: {
    width: '33%',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  completionBar: {
    marginTop: 8,
  },
  // Weekly Card Styles
  weeklyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  weeklyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  weeklyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  weeklyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  weeklyItem: {
    alignItems: 'center',
  },
  weeklyValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  weeklyLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  weeklyProgress: {
    marginTop: 8,
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  insightsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
    marginLeft: 12,
  },
  insightLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  insightSubLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 16,
  },
  // Daily Stats Grid Styles
  dailyStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  dailyStatCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  dailyStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginVertical: 8,
  },
  dailyStatLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  // Weekly Stats Grid Styles
  weeklyStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  weeklyStatCard: {
    width: (width - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  weeklyStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginVertical: 6,
  },
  weeklyStatLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Compact Stats Card Styles
  compactStatsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  compactStatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  compactStatsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  compactStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  compactStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  compactStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  compactStatLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  compactEarningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  compactEarningsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  compactEarningsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  // Chart Button Styles
  chartButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Analysis Modal Styles
  analysisCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  trendContent: {
    flex: 1,
    marginLeft: 12,
  },
  trendLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  trendValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  trendSubtext: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  trendDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  metricDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  weeklySummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  weeklyStat: {
    alignItems: 'center',
  },
  weeklyStatNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  weeklyStatLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  weeklyEarnings: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  weeklyEarningsText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  weeklyEarningsValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  recommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
    marginLeft: 12,
    lineHeight: 20,
  },
  // Chart Styles
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  barChartContainer: {
    marginBottom: 16,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  barLabel: {
    width: 80,
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 4,
  },
  barValue: {
    width: 60,
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    textAlign: 'right',
  },
  chartInsight: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Circular Progress Styles
  progressRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  progressCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  circleContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  circleBackground: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F5F5F5',
    position: 'relative',
    overflow: 'hidden',
  },
  circleProgressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#34C759',
    borderRadius: 35,
  },
  circleValue: {
    position: 'absolute',
    top: 27,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  progressSubtitle: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  // Performance Indicators
  indicatorsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  indicatorItem: {
    alignItems: 'center',
    flex: 1,
  },
  indicatorValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginVertical: 6,
  },
  indicatorLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  // Curve Styles
  curveCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  curveTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  curveContainer: {
    height: 180,
    marginBottom: 16,
    position: 'relative',
  },
  curveGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 30,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  curvePath: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  curvePoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFA500',
  },
  dayLabels: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  curveInsight: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Weekly Grid Styles
  weeklyGridCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  weeklyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  weeklyStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  weeklyStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginVertical: 6,
  },
  weeklyStatText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  weeklyEarningsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  weeklyEarningsBigText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginHorizontal: 8,
  },
  weeklyEarningsLabel: {
    fontSize: 12,
    color: '#666',
  },
  weeklyGridTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  weeklyDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  weeklyDetailItem: {
    alignItems: 'center',
    flex: 1,
  },
  weeklyDetailLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  weeklyDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});

export default DashboardScreen;