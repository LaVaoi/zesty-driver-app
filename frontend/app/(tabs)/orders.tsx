import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { WebView } from 'react-native-webview';
import Colors from '@/constants/Colors';
import { OrderCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { realtimeService } from '../services/realtimeService';

const { width } = Dimensions.get('window');

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  image?: string;
}

interface Order {
  id: number;
  order_number: string;
  status: string;
  delivery_address: string;
  final_price: number;
  delivery_fee?: number;
  payment_status: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  items: OrderItem[];
  delivery_man_id?: number | null;
  delivered_at?: string;
  out_for_delivery_at?: string;
  rating?: {
    id: number;
    rating: number;
    comment?: string;
    created_at: string;
  };
  lat?: number;
  lon?: number;
}

type TabType = 'accepted' | 'delivered';

// Premium Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'Pending':
      case 'Preparing':
        return {
          bg: '#FEF3E2',
          color: '#F97316',
          icon: 'time-outline',
          label: status
        };
      case 'OutForDelivery':
        return {
          bg: '#E3F2FD',
          color: '#2196F3',
          icon: 'bicycle-outline',
          label: 'Out for Delivery'
        };
      case 'Delivered':
        return {
          bg: '#E8F5E9',
          color: '#2E7D32',
          icon: 'checkmark-circle-outline',
          label: 'Delivered'
        };
      default:
        return {
          bg: '#F3F4F6',
          color: '#6B7280',
          icon: 'ellipse-outline',
          label: status
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon as any} size={14} color={config.color} />
      <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// Premium Action Button Component
const ActionButton = ({
  title,
  icon,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: Colors.primary,
          text: Colors.dark,
          border: Colors.primary,
        };
      case 'secondary':
        return {
          bg: '#FEF3E2',
          text: '#F97316',
          border: '#FED7AA',
        };
      case 'destructive':
        return {
          bg: '#FEE2E2',
          text: '#DC2626',
          border: '#FECACA',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <TouchableOpacity
      style={[
        localStyles.actionButton,
        {
          backgroundColor: styles.bg,
          borderColor: styles.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator size="small" color={styles.text} />
      ) : (
        <>
          <Ionicons name={icon} size={18} color={styles.text} />
          <Text style={[localStyles.actionButtonText, { color: styles.text }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// Premium Stat Card Component
const StatCard = ({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) => (
  <View style={localStyles.statCard}>
    <View style={[localStyles.statIconContainer, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <View style={localStyles.statContent}>
      <Text style={localStyles.statValue}>{value}</Text>
      <Text style={localStyles.statLabel}>{label}</Text>
    </View>
  </View>
);

// Premium Order Card Component
const OrderCard = React.memo(({
  order,
  showActions = true,
  onShowLocation,
  onAccept,
  onMarkDelivered,
  updatingStatus,
  tabType,
}: {
  order: Order;
  showActions?: boolean;
  onShowLocation: (order: Order) => void;
  onAccept?: (id: number) => void;
  onMarkDelivered?: (id: number) => void;
  updatingStatus?: number | null;
  tabType?: TabType;
}) => {
  const getPaymentIcon = useCallback((paymentStatus: string) => {
    return paymentStatus === 'Paid' ? 'card-outline' : 'cash-outline';
  }, []);

  const getPaymentColor = useCallback((paymentStatus: string) => {
    return paymentStatus === 'Paid' ? '#10B981' : '#F97316';
  }, []);

  return (
    <View style={localStyles.orderCard}>
      {/* Card Header */}
      <View style={localStyles.cardHeader}>
        <View style={localStyles.orderInfo}>
          <View style={localStyles.orderNumberRow}>
            <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
            <Text style={localStyles.orderNumber}>{order.order_number}</Text>
          </View>
          <Text style={localStyles.customerName}>{order.customer_name || 'Customer'}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {/* Items Preview */}
      {order.items && order.items.length > 0 && (
        <View style={localStyles.itemsPreview}>
          <View style={localStyles.itemsHeader}>
            <Ionicons name="basket-outline" size={14} color={Colors.text.secondary} />
            <Text style={localStyles.itemsCount}>{order.items.length} items</Text>
          </View>
          <Text style={localStyles.itemsSummary} numberOfLines={2}>
            {order.items.map(item => `${item.quantity}x ${item.product_name}`).join(' • ')}
          </Text>
        </View>
      )}

      {/* Delivery Details */}
      <View style={localStyles.detailsGrid}>
        <View style={localStyles.detailRow}>
          <Ionicons name="location-outline" size={16} color={Colors.text.secondary} />
          <Text style={localStyles.detailText} numberOfLines={2}>
            {order.delivery_address || 'No address provided'}
          </Text>
        </View>

        {order.customer_phone && (
          <View style={localStyles.detailRow}>
            <Ionicons name="call-outline" size={16} color={Colors.text.secondary} />
            <Text style={localStyles.detailText}>{order.customer_phone}</Text>
          </View>
        )}

        <View style={localStyles.paymentRow}>
          <View style={localStyles.paymentMethod}>
            <Ionicons
              name={getPaymentIcon(order.payment_status) as any}
              size={14}
              color={getPaymentColor(order.payment_status)}
            />
            <Text style={[localStyles.paymentText, { color: getPaymentColor(order.payment_status) }]}>
              {order.payment_status === 'Paid' ? 'Paid' : 'Cash on Delivery'}
            </Text>
          </View>

          {order.delivery_fee !== undefined && order.delivery_fee !== null && (
            <View style={localStyles.deliveryFee}>
              <Ionicons name="bicycle-outline" size={14} color={Colors.text.secondary} />
              <Text style={localStyles.deliveryFeeText}>
                +{(Number(order.delivery_fee) || 0).toFixed(2)} MAD
              </Text>
            </View>
          )}
        </View>

        <View style={localStyles.totalRow}>
          <Text style={localStyles.totalLabel}>Total</Text>
          <Text style={localStyles.totalValue}>{(Number(order?.final_price) || 0).toFixed(2)} MAD</Text>
        </View>
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View style={localStyles.actionRow}>
          <ActionButton
            title="Location"
            icon="map-outline"
            onPress={() => onShowLocation(order)}
            variant="secondary"
          />

          {order.status === 'OutForDelivery' && onMarkDelivered && (
            <ActionButton
              title="Delivered"
              icon="checkmark-circle"
              onPress={() => onMarkDelivered(order.id)}
              variant="primary"
              loading={updatingStatus === order.id}
              disabled={updatingStatus === order.id}
            />
          )}

          {tabType === 'available' && onAccept && (
            <ActionButton
              title="Accept"
              icon="checkmark"
              onPress={() => onAccept(order.id)}
              variant="primary"
            />
          )}
        </View>
      )}

      {/* Status Message for Accepted Orders */}
      {tabType === 'accepted' && (order.status === 'Pending' || order.status === 'Preparing') && (
        <View style={localStyles.statusMessage}>
          <View style={localStyles.pulseDot} />
          <Text style={localStyles.statusMessageText}>
            {order.status === 'Preparing'
              ? 'Restaurant is preparing your order...'
              : 'Waiting for restaurant to prepare...'}
          </Text>
        </View>
      )}
    </View>
  );
});

// Premium Delivered Order Card
const DeliveredOrderCard = React.memo(({ order }: { order: Order }) => (
  <View style={localStyles.orderCard}>
    <View style={localStyles.cardHeader}>
      <View style={localStyles.orderInfo}>
        <View style={localStyles.orderNumberRow}>
          <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
          <Text style={localStyles.orderNumber}>{order.order_number}</Text>
        </View>
        <Text style={localStyles.customerName}>{order.customer_name || 'Customer'}</Text>
      </View>
      <View style={[localStyles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
        <Ionicons name="checkmark-circle-outline" size={14} color="#2E7D32" />
        <Text style={[localStyles.statusText, { color: '#2E7D32' }]}>Delivered</Text>
      </View>
    </View>

    {/* Order Items */}
    {order.items && order.items.length > 0 && (
      <View style={localStyles.itemsPreview}>
        <View style={localStyles.itemsHeader}>
          <Ionicons name="basket-outline" size={14} color={Colors.text.secondary} />
          <Text style={localStyles.itemsCount}>{order.items.length} items</Text>
        </View>
        <Text style={localStyles.itemsSummary} numberOfLines={2}>
          {order.items.map(item => `${item.quantity}x ${item.product_name}`).join(' • ')}
        </Text>
      </View>
    )}

    {/* Delivery Info */}
    <View style={localStyles.detailsGrid}>
      <View style={localStyles.detailRow}>
        <Ionicons name="location-outline" size={16} color={Colors.text.secondary} />
        <Text style={localStyles.detailText} numberOfLines={2}>
          {order.delivery_address || 'No address provided'}
        </Text>
      </View>

      {order.delivered_at && (
        <View style={localStyles.detailRow}>
          <Ionicons name="time-outline" size={16} color={Colors.text.secondary} />
          <Text style={localStyles.detailText}>
            Delivered {new Date(order.delivered_at).toLocaleDateString()}
          </Text>
        </View>
      )}

      <View style={localStyles.totalRow}>
        <Text style={localStyles.totalLabel}>Delivery Fee</Text>
        <Text style={localStyles.totalValue}>
          {(Number(order.delivery_fee) || 0).toFixed(2)} MAD
        </Text>
      </View>
    </View>

    {/* Rating Section */}
    {order.rating ? (
      <View style={localStyles.ratingContainer}>
        <View style={localStyles.ratingStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= order.rating!.rating ? 'star' : 'star-outline'}
              size={16}
              color="#F59E0B"
            />
          ))}
          <Text style={localStyles.ratingValue}>{order.rating.rating}/5</Text>
        </View>
        {order.rating.comment && (
          <Text style={localStyles.ratingComment}>"{order.rating.comment}"</Text>
        )}
      </View>
    ) : (
      <View style={localStyles.noRatingContainer}>
        <Ionicons name="star-outline" size={16} color={Colors.gray[400]} />
        <Text style={localStyles.noRatingText}>No rating yet</Text>
      </View>
    )}
  </View>
));

const ActiveOrdersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('accepted');
  const [orders, setOrders] = useState<Order[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [acceptedOrders, setAcceptedOrders] = useState<Order[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [mapUrl, setMapUrl] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [stats, setStats] = useState({
    totalDeliveryFees: 0,
    avgRating: 0,
    avgDeliveryTime: 0,
    totalDeliveries: 0,
  });
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // [ALL EXISTING BUSINESS LOGIC REMAINS EXACTLY THE SAME]
  const fetchOrders = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [pendingResponse, assignedResponse, deliveredResponse] = await Promise.all([
        fetch('https://ubua.cloud/api/delivery/orders/pending', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch('https://ubua.cloud/api/delivery/my-orders', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch('https://ubua.cloud/api/delivery/delivered-orders', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
      ]);

      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const unassignedOrders = (pendingData.orders || []).filter(
          (order: Order) => !order.delivery_man_id || order.delivery_man_id === null
        );
        console.log('Pending Response Status: zap', unassignedOrders);
        setOrders(unassignedOrders);
      } else if (pendingResponse.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.removeItem('deliveryManToken');
        return;
      }

      if (assignedResponse.ok) {
        const assignedData = await assignedResponse.json();
        const allAssigned = assignedData.orders || [];
        const validAssigned = allAssigned.filter(
          (order: Order) => order.delivery_man_id !== null && order.delivery_man_id !== undefined
        );
        const outForDelivery = validAssigned.filter(
          (order: Order) => order.status === 'OutForDelivery'
        );
        setAssignedOrders(outForDelivery);

        const accepted = validAssigned.filter(
          (order: Order) => order.status === 'Pending' || order.status === 'Preparing'
        );
        setAcceptedOrders(accepted);
      } else if (assignedResponse.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.removeItem('deliveryManToken');
        return;
      }

      if (deliveredResponse.ok) {
        const deliveredData = await deliveredResponse.json();
        setDeliveredOrders(deliveredData.orders || []);
      } else if (deliveredResponse.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.removeItem('deliveryManToken');
        return;
      }

      try {
        const statsResponse = await fetch('https://ubua.cloud/api/delivery/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('Stats Response Status:', statsResponse.status);
        console.log('Stats Response OK:', statsResponse.ok);

        if (statsResponse.ok) {
          const statsText = await statsResponse.text();
          console.log('Stats Raw Response Text:', statsText);

          try {
            const statsData = JSON.parse(statsText);
            console.log('Parsed Stats Data:', JSON.stringify(statsData, null, 2));
            console.log('Stats Data Keys:', Object.keys(statsData));

            console.log('total_delivery_fees from API:', statsData.total_delivery_fees);
            console.log('avg_rating from API:', statsData.avg_rating);
            console.log('avg_delivery_time from API:', statsData.avg_delivery_time);
            console.log('total_deliveries from API:', statsData.total_deliveries);

            setStats({
              totalDeliveryFees: statsData.total_delivery_fees || 0,
              avgRating: statsData.avg_rating || 0,
              avgDeliveryTime: statsData.avg_delivery_time || 0,
              totalDeliveries: statsData.total_deliveries || 0,
            });

            console.log('Stats state after setting:', {
              totalDeliveryFees: statsData.total_delivery_fees || 0,
              avgRating: statsData.avg_rating || 0,
              avgDeliveryTime: statsData.avg_delivery_time || 0,
              totalDeliveries: statsData.total_deliveries || 0,
            });
          } catch (parseError) {
            console.error('Error parsing stats JSON:', parseError);
            console.error('Response text that failed to parse:', statsText);
          }
        } else {
          console.warn('Stats fetch failed with status:', statsResponse.status);
          const errorText = await statsResponse.text();
          console.warn('Stats error response:', errorText);
        }
      } catch (statsError) {
        console.error('Network error fetching stats:', statsError);
      }

    } catch (error) {
      console.error('Error fetching orders:', error);
      if (!refreshing) {
        Alert.alert('Error', 'Failed to fetch orders. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

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
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    const locationInterval = setInterval(() => {
      updateLocation();
    }, 10000);

    updateLocation();

    return () => {
      clearInterval(locationInterval);
    };
  }, [fetchOrders, updateLocation]);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe('orders', fetchOrders, 3000);

    return () => {
      unsubscribe();
    };
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const handleShowLocation = async (order: Order) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (!order.delivery_address || order.delivery_address.trim() === '') {
        Alert.alert('No Address', 'Delivery address is not available for this order');
        return;
      }

      let currentLat: number | null = null;
      let currentLng: number | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          currentLat = location.coords.latitude;
          currentLng = location.coords.longitude;
        }
      } catch (locError) {
        console.log('Could not get current location:', locError);
      }

      const address = encodeURIComponent(order.delivery_address.trim());

      let mapsUrl: string;
      if (currentLat && currentLng && order.lat && order.lon) {
        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${order.lat},${order.lon}&travelmode=driving`;
      } else if (order.lat && order.lon) {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lon}`;
      } else {
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
      }

      setSelectedOrder(order);
      setMapUrl(mapsUrl);
      setShowMap(true);
    } catch (error) {
      console.error('Error showing location:', error);
      Alert.alert('Error', 'Failed to show location');
    }
  };

  const acceptOrder = async (orderId: number) => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await fetch('https://ubua.cloud/api/delivery/accept-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Order Assigned',
          'Order has been assigned to you. Wait for the restaurant to prepare it. You will be notified when it\'s ready for delivery.',
          [{
            text: 'OK', onPress: () => {
              fetchOrders();
              setActiveTab('accepted');
            }
          }]
        );
      } else if (response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.removeItem('deliveryManToken');
      } else {
        const data = await response.json().catch(() => ({ message: 'Failed to accept order' }));
        Alert.alert('Error', data.message || 'Failed to accept order');
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    }
  };

  const markAsDelivered = async (orderId: number) => {
    try {
      setUpdatingStatus(orderId);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        setUpdatingStatus(null);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await fetch('https://ubua.cloud/api/delivery/update-order-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ order_id: orderId, status: 'Delivered' }),
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Order marked as delivered!', [
          { text: 'OK', onPress: () => fetchOrders() }
        ]);
      } else if (response.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.removeItem('deliveryManToken');
      } else {
        const data = await response.json().catch(() => ({ message: 'Failed to update order status' }));
        Alert.alert('Error', data.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert('Error', 'Network error. Please check your connection and try again.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const renderSkeleton = () => (
    <ScrollView
      style={localStyles.scrollView}
      contentContainerStyle={localStyles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={localStyles.section}>
        {[1, 2, 3].map((item) => (
          <OrderCardSkeleton key={item} />
        ))}
      </View>
    </ScrollView>
  );

  if (loading && orders.length === 0 && acceptedOrders.length === 0 && assignedOrders.length === 0) {
    return (
      <View style={[localStyles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[Colors.dark, Colors.darkLight]}
          style={localStyles.header}>
          <View style={localStyles.headerContent}>
            <View>
              <Text style={localStyles.headerTitle}>Orders</Text>
              <Text style={localStyles.headerSubtitle}>Manage your deliveries</Text>
            </View>
            <View style={localStyles.headerIcon}>
              <Ionicons name="bicycle" size={28} color="#fff" />
            </View>
          </View>
        </LinearGradient>
        {renderSkeleton()}
      </View>
    );
  }

  return (
    <View style={[localStyles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[Colors.dark, Colors.darkLight]}
        style={localStyles.header}>
        <View style={localStyles.headerContent}>
          <View>
            <Text style={localStyles.headerTitle}>Orders</Text>
            <Text style={localStyles.headerSubtitle}>Manage your deliveries</Text>
          </View>
          <View style={localStyles.headerStats}>
            <View style={localStyles.headerStat}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
              <Text style={localStyles.headerStatText}>{acceptedOrders.length + assignedOrders.length} active</Text>
            </View>
            <View style={localStyles.headerStatDivider} />
            <View style={localStyles.headerStat}>
              <Ionicons name="checkmark-done" size={16} color="#fff" />
              <Text style={localStyles.headerStatText}>{deliveredOrders.length} completed</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Grid */}
      <View style={localStyles.statsGrid}>
        <StatCard
          icon="cash-outline"
          value={`${stats.totalDeliveryFees.toFixed(2)} MAD`}
          label="Total Fees"
          color="#10B981"
        />
        <StatCard
          icon="star-outline"
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}
          label="Avg Rating"
          color="#F59E0B"
        />
        <StatCard
          icon="time-outline"
          value={stats.avgDeliveryTime > 0 ? `${Math.round(stats.avgDeliveryTime)}m` : 'N/A'}
          label="Avg Time"
          color="#3B82F6"
        />
      </View>

      {/* Segmented Control */}
      <View style={localStyles.segmentedControl}>
        <TouchableOpacity
          style={[localStyles.segment, activeTab === 'accepted' && localStyles.segmentActive]}
          onPress={() => {
            setActiveTab('accepted');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}>
          <Ionicons
            name="bicycle"
            size={18}
            color={activeTab === 'accepted' ? Colors.primary : Colors.text.secondary}
          />
          <Text style={[localStyles.segmentText, activeTab === 'accepted' && localStyles.segmentTextActive]}>
            Active ({acceptedOrders.length + assignedOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[localStyles.segment, activeTab === 'delivered' && localStyles.segmentActive]}
          onPress={() => {
            setActiveTab('delivered');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}>
          <Ionicons
            name="checkmark-done"
            size={18}
            color={activeTab === 'delivered' ? Colors.primary : Colors.text.secondary}
          />
          <Text style={[localStyles.segmentText, activeTab === 'delivered' && localStyles.segmentTextActive]}>
            Delivered ({deliveredOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={localStyles.scrollView}
        contentContainerStyle={localStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}>

        {loading ? (
          renderSkeleton()
        ) : activeTab === 'delivered' ? (
          <>
            {deliveredOrders.length > 0 ? (
              <View style={localStyles.section}>
                {deliveredOrders.map((order: Order) => (
                  <DeliveredOrderCard key={order.id} order={order} />
                ))}
              </View>
            ) : (
              <View style={localStyles.emptyState}>
                <View style={localStyles.emptyStateIcon}>
                  <Ionicons name="checkmark-done" size={48} color={Colors.gray[400]} />
                </View>
                <Text style={localStyles.emptyStateTitle}>No delivered orders</Text>
                <Text style={localStyles.emptyStateSubtitle}>
                  Completed deliveries will appear here
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Ready for Delivery Section */}
            {assignedOrders.length > 0 && (
              <View style={localStyles.section}>
                <View style={localStyles.sectionHeader}>
                  <View style={localStyles.sectionTitleContainer}>
                    <View style={[localStyles.sectionDot, { backgroundColor: '#2196F3' }]} />
                    <Text style={localStyles.sectionTitle}>Ready for Delivery</Text>
                  </View>
                  <View style={localStyles.sectionBadge}>
                    <Text style={localStyles.sectionBadgeText}>{assignedOrders.length}</Text>
                  </View>
                </View>
                {assignedOrders.map((order: Order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    showActions={true}
                    onShowLocation={handleShowLocation}
                    onMarkDelivered={markAsDelivered}
                    updatingStatus={updatingStatus}
                    tabType={activeTab}
                  />
                ))}
              </View>
            )}

            {/* Waiting Section */}
            {acceptedOrders.length > 0 && (
              <View style={localStyles.section}>
                <View style={localStyles.sectionHeader}>
                  <View style={localStyles.sectionTitleContainer}>
                    <View style={[localStyles.sectionDot, { backgroundColor: '#F97316' }]} />
                    <Text style={localStyles.sectionTitle}>Waiting for Restaurant</Text>
                  </View>
                  <View style={[localStyles.sectionBadge, localStyles.pulseBadge]}>
                    <View style={localStyles.pulseDot} />
                    <Text style={localStyles.sectionBadgeText}>{acceptedOrders.length}</Text>
                  </View>
                </View>
                {acceptedOrders.map((order: Order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    showActions={false}
                    onShowLocation={handleShowLocation}
                    tabType={activeTab}
                  />
                ))}
              </View>
            )}

            {acceptedOrders.length === 0 && assignedOrders.length === 0 && (
              <View style={localStyles.emptyState}>
                <View style={localStyles.emptyStateIcon}>
                  <Ionicons name="bicycle" size={48} color={Colors.gray[400]} />
                </View>
                <Text style={localStyles.emptyStateTitle}>No active orders</Text>
                <Text style={localStyles.emptyStateSubtitle}>
                  Orders assigned to you will appear here
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Map Modal */}
      <Modal
        visible={showMap}
        animationType="slide"
        onRequestClose={() => setShowMap(false)}>
        <View style={localStyles.mapContainer}>
          <View style={localStyles.mapHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowMap(false);
                setSelectedOrder(null);
              }}
              style={localStyles.mapCloseButton}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={localStyles.mapHeaderTitle}>Delivery Location</Text>
            <View style={{ width: 40 }} />
          </View>

          <WebView
            source={{ uri: mapUrl }}
            style={localStyles.mapWebView}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
            renderLoading={() => (
              <View style={localStyles.mapLoadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={localStyles.mapLoadingText}>Loading map...</Text>
              </View>
            )}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView error: ', nativeEvent);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.error('WebView HTTP error: ', nativeEvent);
            }}
            onLoadEnd={() => {
              console.log('Map loaded successfully');
            }}
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith('intent://') || request.url.startsWith('geo:')) {
                return false;
              }
              return true;
            }}
          />

          {selectedOrder && (
            <View style={localStyles.mapInfo}>
              <View style={localStyles.mapInfoHeader}>
                <View style={localStyles.mapInfoIcon}>
                  <Ionicons name="location" size={24} color="#FF3B30" />
                </View>
                <View style={localStyles.mapInfoContent}>
                  <Text style={localStyles.mapInfoAddress}>{selectedOrder.delivery_address}</Text>
                  <Text style={localStyles.mapInfoCustomer}>
                    {selectedOrder.customer_name} • {selectedOrder.customer_phone}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={localStyles.openMapsButton}
                onPress={() => {
                  let url = '';
                  if (selectedOrder.lat && selectedOrder.lon) {
                    const lat = selectedOrder.lat;
                    const lng = selectedOrder.lon;
                    const label = encodeURIComponent(selectedOrder.customer_name || 'Delivery Request');

                    if (Platform.OS === 'ios') {
                      url = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&t=m`;
                    } else {
                      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
                    }
                  } else {
                    const address = encodeURIComponent(selectedOrder.delivery_address);
                    url = Platform.OS === 'ios'
                      ? `http://maps.apple.com/?daddr=${address}&dirflg=d&t=m`
                      : `https://www.google.com/maps/dir/?api=1&destination=${address}&travelmode=driving`;
                  }
                  Linking.openURL(url);
                }}>
                <Ionicons name="navigate" size={20} color={Colors.dark} />
                <Text style={localStyles.openMapsButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  headerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 14,
    gap: 10,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  segmentActive: {
    backgroundColor: Colors.primary + '15',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  pulseBadge: {
    backgroundColor: '#FEF3E2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F97316',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: -0.3,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemsPreview: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  itemsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  itemsSummary: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
  },
  detailsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginVertical: 4,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deliveryFee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryFeeText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3E2',
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
    gap: 10,
  },
  statusMessageText: {
    flex: 1,
    fontSize: 13,
    color: '#F97316',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  ratingContainer: {
    backgroundColor: '#FEF3E2',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 6,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginLeft: 8,
  },
  ratingComment: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
  },
  noRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noRatingText: {
    fontSize: 13,
    color: '#64748B',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  mapCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  mapWebView: {
    flex: 1,
  },
  mapLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  mapInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  mapInfoHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  mapInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapInfoContent: {
    flex: 1,
  },
  mapInfoAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 22,
  },
  mapInfoCustomer: {
    fontSize: 14,
    color: '#64748B',
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  openMapsButtonText: {
    color: Colors.dark,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ActiveOrdersScreen;