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

const { width, height } = Dimensions.get('window');

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
    avgDeliveryTime: 0, // in minutes
    totalDeliveries: 0,
  });
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update the fetchOrders function to handle stats fetching separately with better error handling
  const fetchOrders = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch orders data in parallel
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
      // Handle pending orders
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

      // Handle assigned orders
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

      // Handle delivered orders
      if (deliveredResponse.ok) {
        const deliveredData = await deliveredResponse.json();
        setDeliveredOrders(deliveredData.orders || []);
      } else if (deliveredResponse.status === 401) {
        Alert.alert('Session Expired', 'Please login again');
        await AsyncStorage.removeItem('deliveryManToken');
        return;
      }

      // Now fetch stats separately with better error handling
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

            // Debug: Check each field individually
            console.log('total_delivery_fees from API:', statsData.total_delivery_fees);
            console.log('avg_rating from API:', statsData.avg_rating);
            console.log('avg_delivery_time from API:', statsData.avg_delivery_time);
            console.log('total_deliveries from API:', statsData.total_deliveries);

            // Set the stats with the exact field names from the backend
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

    // Update location every 10 seconds when orders screen is active
    const locationInterval = setInterval(() => {
      updateLocation();
    }, 10000); // Update every 10 seconds

    // Initial location update
    updateLocation();

    return () => {
      clearInterval(locationInterval);
    };
  }, [fetchOrders, updateLocation]);

  // Use real-time service for auto-refresh
  useEffect(() => {
    // Subscribe to real-time updates for all tabs
    const unsubscribe = realtimeService.subscribe('orders', fetchOrders, 3000); // Update every 3 seconds

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

      // Check if address exists
      if (!order.delivery_address || order.delivery_address.trim() === '') {
        Alert.alert('No Address', 'Delivery address is not available for this order');
        return;
      }

      // Request location permission and get current location for directions
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
        // Continue without current location - will just show destination
      }

      // Encode the delivery address properly
      const address = encodeURIComponent(order.delivery_address.trim());

      // Use Google Maps directions URL if we have current location, otherwise use place URL
      // This will show the map with route from current location to destination
      let mapsUrl: string;
      if (currentLat && currentLng) {
        // Show directions from current location to destination
        // Uses origin=currentLocation and destination=orderLocation
        mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${order.lat},${order.lon}&travelmode=driving`;
      } else {
        // Show just the destination location (no directions)
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lon}`;
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
              // Switch to accepted tab to see the new order
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

  const getPaymentMethod = useCallback((paymentStatus: string) => {
    return paymentStatus === 'Paid' ? 'Card' : 'Cash on Delivery';
  }, []);

  const getPaymentIcon = useCallback((paymentStatus: string) => {
    return paymentStatus === 'Paid' ? 'card' : 'cash';
  }, []);

  const getStatusColor = useCallback((status: string) => {
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
  }, []);

  const getStatusIcon = useCallback((status: string) => {
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
        return 'ellipse-outline';
    }
  }, []);

  const renderDeliveredOrderCard = React.useCallback((order: Order) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <View style={styles.orderNumberContainer}>
            <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
            <Text style={styles.orderNumber}>{order.order_number}</Text>
          </View>
          <Text style={styles.customerName}>
            {order.customer_name || 'Customer'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${Colors.success}20` }]}>
          <Ionicons
            name="checkmark-circle-outline"
            size={12}
            color={Colors.success}
          />
          <Text style={[styles.statusText, { color: Colors.success }]}>
            Delivered
          </Text>
        </View>
      </View>

      {/* Order Items */}
      {order.items && order.items.length > 0 && (
        <View style={styles.orderItems}>
          <Text style={styles.itemsTitle}>Order Items:</Text>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.orderItemRow}>
              <View style={styles.orderItemBullet} />
              <Text style={styles.orderItem}>
                {item.quantity}x {item.product_name} - {item.price.toFixed(2)} MAD
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Delivery Info */}
      <View style={styles.deliveryInfoContainer}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={Colors.text.secondary} />
          <Text style={styles.infoText} numberOfLines={2}>
            {order.delivery_address || 'No address provided'}
          </Text>
        </View>
        {order.delivered_at && (
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.infoText}>
              Delivered: {new Date(order.delivered_at).toLocaleString()}
            </Text>
          </View>
        )}
        {order.delivery_fee !== undefined && order.delivery_fee !== null && (
          <View style={styles.deliveryFeeRow}>
            <Ionicons name="bicycle-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.deliveryFeeLabel}>Delivery Fee:</Text>
            <Text style={styles.deliveryFeeValue}>
              {(Number(order.delivery_fee) || 0).toFixed(2)} MAD
            </Text>
          </View>
        )}
      </View>

      {/* Rating Section */}
      {order.rating ? (
        <View style={styles.ratingContainer}>
          <View style={styles.ratingHeader}>
            <Ionicons name="star" size={20} color="#F59E0B" />
            <Text style={styles.ratingTitle}>Customer Rating</Text>
          </View>
          <View style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= order.rating!.rating ? "star" : "star-outline"}
                size={20}
                color="#F59E0B"
              />
            ))}
            <Text style={styles.ratingValue}>{order.rating.rating}/5</Text>
          </View>
          {order.rating.comment && (
            <View style={styles.ratingComment}>
              <Text style={styles.ratingCommentText}>"{order.rating.comment}"</Text>
            </View>
          )}
          <Text style={styles.ratingDate}>
            {new Date(order.rating.created_at).toLocaleDateString()}
          </Text>
        </View>
      ) : (
        <View style={styles.noRatingContainer}>
          <Ionicons name="star-outline" size={20} color={Colors.gray[400]} />
          <Text style={styles.noRatingText}>No rating yet</Text>
        </View>
      )}
    </View>
  ), []);

  const renderOrderCard = React.useCallback((order: Order, showActions: boolean = true) => (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <View style={styles.orderNumberContainer}>
            <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
            <Text style={styles.orderNumber}>{order.order_number}</Text>
          </View>
          <Text style={styles.customerName}>
            {order.customer_name || 'Customer'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(order.status)}20` }]}>
          <Ionicons
            name={getStatusIcon(order.status) as any}
            size={12}
            color={getStatusColor(order.status)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {order.status}
          </Text>
        </View>
      </View>

      {/* Order Items */}
      {order.items && order.items.length > 0 && (
        <View style={styles.orderItems}>
          <Text style={styles.itemsTitle}>Order Items:</Text>
          {order.items.map((item, idx) => (
            <View key={idx} style={styles.orderItemRow}>
              <View style={styles.orderItemBullet} />
              <Text style={styles.orderItem}>
                {item.quantity}x {item.product_name} - {item.price.toFixed(2)} MAD
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Payment Method */}
      <View style={styles.paymentMethodContainer}>
        <Ionicons
          name={getPaymentIcon(order.payment_status) as any}
          size={16}
          color={order.payment_status === 'Paid' ? Colors.success : '#FF9500'}
        />
        <Text style={styles.paymentMethodText}>
          Payment: {getPaymentMethod(order.payment_status)}
        </Text>
      </View>

      {/* Customer Info */}
      <View style={styles.customerInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={Colors.text.secondary} />
          <Text style={styles.infoText} numberOfLines={2}>
            {order.delivery_address || 'No address provided'}
          </Text>
        </View>
        {order.customer_phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.infoText}>{order.customer_phone}</Text>
          </View>
        )}
        {order.customer_email && showActions && (
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.infoText}>{order.customer_email}</Text>
          </View>
        )}
      </View>

      {/* Delivery Fee */}
      {order.delivery_fee !== undefined && order.delivery_fee !== null && (
        <View style={styles.deliveryFeeContainer}>
          <View style={styles.deliveryFeeRow}>
            <Ionicons name="bicycle-outline" size={16} color={Colors.text.secondary} />
            <Text style={styles.deliveryFeeLabel}>Delivery Fee:</Text>
            <Text style={styles.deliveryFeeValue}>
              {(Number(order.delivery_fee) || 0).toFixed(2)} MAD
            </Text>
          </View>
        </View>
      )}

      {/* Order Total */}
      <View style={styles.orderTotalContainer}>
        <Text style={styles.orderTotalLabel}>Total:</Text>
        <Text style={styles.orderTotal}>
          {(Number(order?.final_price) || 0).toFixed(2)} MAD
        </Text>
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View style={styles.actionButtons}>
          {order.status === 'OutForDelivery' ? (
            <>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => handleShowLocation(order)}
                activeOpacity={0.8}
              >
                <Ionicons name="map-outline" size={18} color={Colors.primary} />
                <Text style={styles.locationButtonText}>Show Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deliveredButton}
                onPress={() => markAsDelivered(order.id)}
                disabled={updatingStatus === order.id}
                activeOpacity={0.8}
              >
                {updatingStatus === order.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    <Text style={styles.deliveredButtonText}>Mark as Delivered</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => handleShowLocation(order)}
                activeOpacity={0.8}
              >
                <Ionicons name="map-outline" size={18} color={Colors.primary} />
                <Text style={styles.locationButtonText}>Show Location</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Status Update Message for Accepted Orders */}
      {activeTab === 'accepted' && (order.status === 'Pending' || order.status === 'Preparing') && (
        <View style={styles.waitingMessage}>
          <Ionicons name="information-circle-outline" size={16} color="#FF9500" />
          <Text style={styles.waitingMessageText}>
            {order.status === 'Preparing'
              ? 'Restaurant is preparing your order...'
              : 'Order assigned. Waiting for restaurant to prepare it...'}
          </Text>
        </View>
      )}
    </View>
  ), [activeTab, updatingStatus]);

  const renderSkeleton = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Skeleton width={150} height={18} borderRadius={4} style={{ marginBottom: 12 }} />
        {[1, 2, 3].map((item) => (
          <OrderCardSkeleton key={item} />
        ))}
      </View>
    </ScrollView>
  );

  if (loading && orders.length === 0 && acceptedOrders.length === 0 && assignedOrders.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[Colors.dark, Colors.darkLight]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Active Orders</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
            <Ionicons name="list" size={32} color="#fff" />
          </View>
        </LinearGradient>
        <View style={styles.tabContainer}>
          <View style={[styles.tab, styles.tabActive]}>
            <Skeleton width={100} height={16} borderRadius={4} />
          </View>
          <View style={styles.tab}>
            <Skeleton width={100} height={16} borderRadius={4} />
          </View>
        </View>
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
            <Text style={styles.headerTitle}>Active Orders</Text>
            <Text style={styles.headerSubtitle}>
              {activeTab === 'accepted'
                ? `${acceptedOrders.length} accepted • ${assignedOrders.length} ready`
                : `${deliveredOrders.length} delivered orders`}
            </Text>
          </View>
          <Ionicons name="list" size={32} color="#fff" />
        </View>
      </LinearGradient>

      {/* Stats Bar */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="cash-outline" size={20} color="#10B981" />
          <View style={styles.statContent}>
            <Text style={styles.statValue}>{stats.totalDeliveryFees.toFixed(2)} MAD</Text>
            <Text style={styles.statLabel}>Total Fees</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="star-outline" size={20} color="#F59E0B" />
          <View style={styles.statContent}>
            <Text style={styles.statValue}>
              {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Avg Rating</Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={20} color="#3B82F6" />
          <View style={styles.statContent}>
            <Text style={styles.statValue}>
              {stats.avgDeliveryTime > 0 ? `${Math.round(stats.avgDeliveryTime)}m` : 'N/A'}
            </Text>
            <Text style={styles.statLabel}>Avg Time</Text>
          </View>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'accepted' && styles.tabActive]}
          onPress={() => {
            setActiveTab('accepted');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color={activeTab === 'accepted' ? Colors.primary : Colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'accepted' && styles.tabTextActive]}>
            Active ({acceptedOrders.length + assignedOrders.length})
          </Text>
          {activeTab === 'accepted' && (acceptedOrders.length > 0 || assignedOrders.length > 0) && (
            <View style={styles.autoRefreshIndicator}>
              <View style={styles.autoRefreshDot} />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'delivered' && styles.tabActive]}
          onPress={() => {
            setActiveTab('delivered');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={18}
            color={activeTab === 'delivered' ? Colors.primary : Colors.text.secondary}
          />
          <Text style={[styles.tabText, activeTab === 'delivered' && styles.tabTextActive]}>
            Delivered ({deliveredOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && (orders.length === 0 && acceptedOrders.length === 0 && assignedOrders.length === 0 && deliveredOrders.length === 0) ? (
          renderSkeleton()
        ) : activeTab === 'delivered' ? (
          <>
            {/* Delivered Orders */}
            {deliveredOrders.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivered Orders</Text>
                <Text style={styles.sectionSubtitle}>
                  View your delivery history and ratings
                </Text>
                {deliveredOrders.map((order: Order) => (
                  <React.Fragment key={order.id}>
                    {renderDeliveredOrderCard(order)}
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { paddingHorizontal: 16 }]}>
                <Ionicons name="checkmark-done-outline" size={64} color={Colors.gray[400]} />
                <Text style={styles.emptyStateText}>No delivered orders</Text>
                <Text style={styles.emptyStateSubtext}>
                  Completed deliveries will appear here
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Ready for Delivery Orders */}
            {assignedOrders.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ready for Delivery</Text>
                {assignedOrders.map((order: Order) => (
                  <React.Fragment key={order.id}>
                    {renderOrderCard(order, true)}
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Accepted Orders - Waiting for Restaurant */}
            {acceptedOrders.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Waiting for Restaurant</Text>
                    <Text style={styles.sectionSubtitle}>
                      Orders are being prepared. Status updates automatically every 5 seconds.
                    </Text>
                  </View>
                  <View style={styles.autoRefreshBadge}>
                    <View style={styles.autoRefreshPulse} />
                    <Ionicons name="sync" size={14} color={Colors.success} />
                  </View>
                </View>
                {acceptedOrders.map((order: Order) => (
                  <React.Fragment key={order.id}>
                    {renderOrderCard(order, false)}
                  </React.Fragment>
                ))}
              </View>
            )}

            {acceptedOrders.length === 0 && assignedOrders.length === 0 && (
              <View style={[styles.emptyState, { paddingHorizontal: 16 }]}>
                <Ionicons name="checkmark-circle-outline" size={64} color={Colors.gray[400]} />
                <Text style={styles.emptyStateText}>No accepted orders</Text>
                <Text style={styles.emptyStateSubtext}>
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
        onRequestClose={() => setShowMap(false)}
      >
        <View style={styles.mapContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowMap(false);
                setSelectedOrder(null);
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Delivery Location</Text>
            <View style={{ width: 24 }} />
          </View>

          <WebView
            source={{ uri: mapUrl }}
            style={styles.mapWebView}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
            renderLoading={() => (
              <View style={styles.mapLoadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.mapLoadingText}>Loading map...</Text>
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
              // Prevent weird intent:// redirections (common with Google Maps on Android)
              if (request.url.startsWith('intent://') || request.url.startsWith('geo:')) {
                return false;
              }
              return true;
            }}
          />

          {selectedOrder && (
            <View style={styles.mapInfo}>
              <View style={styles.mapInfoHeader}>
                <Ionicons name="location" size={24} color="#FF3B30" />
                <View style={styles.mapInfoContent}>
                  <Text style={styles.mapInfoTitle}>Delivery Address</Text>
                  <Text style={styles.mapInfoAddress}>{selectedOrder.delivery_address}</Text>
                  <Text style={styles.mapInfoCustomer}>
                    {selectedOrder.customer_name} • {selectedOrder.customer_phone}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.openMapsButton}
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
                }}
              >
                <Ionicons name="navigate" size={20} color={Colors.dark} />
                <Text style={styles.openMapsButtonText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
    position: 'relative',
  },
  tabActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  autoRefreshIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  autoRefreshDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  autoRefreshBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    position: 'relative',
  },
  autoRefreshPulse: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    opacity: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 6,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orderItems: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderItemBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.secondary,
    marginRight: 8,
  },
  orderItem: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  customerInfo: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  deliveryFeeContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 8,
  },
  deliveryFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryFeeLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  deliveryFeeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  orderTotalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    marginBottom: 12,
  },
  orderTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  locationButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  acceptButtonText: {
    color: Colors.dark,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  acceptButtonDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.gray[400],
  },
  deliveredButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.success,
  },
  deliveredButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  waitingMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  waitingMessageText: {
    fontSize: 13,
    color: '#FF9500',
    marginLeft: 8,
    flex: 1,
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
  closeButton: {
    padding: 8,
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
    backgroundColor: '#F9FAFB',
  },
  mapLoadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  mapInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  mapInfoHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  mapInfoContent: {
    flex: 1,
    marginLeft: 12,
  },
  mapInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  mapInfoAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  mapInfoCustomer: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  openMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  openMapsButtonText: {
    color: Colors.dark,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 12,
    gap: 8,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  deliveryInfoContainer: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  ratingContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  ratingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  ratingComment: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#FED7AA',
  },
  ratingCommentText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: Colors.text.secondary,
  },
  ratingDate: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 6,
  },
  noRatingContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noRatingText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
});

export default ActiveOrdersScreen;
