// app/(tabs)/orders.tsx
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import * as Linking from 'expo-linking';
import { NativeModules } from 'react-native';
const { DriverAlarm } = NativeModules;
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
  Pressable,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { FlashList } from '@shopify/flash-list';
import Colors from '@/constants/Colors';
import { OrderCardSkeleton } from '@/components/ui/skeleton';
import { realtimeService } from '../services/realtimeService';
import { useLanguage } from '@/constants/contexts/LanguageContext';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────
// Design System  (unchanged)
// ─────────────────────────────────────────────
const DS = {
  colors: {
    bg: '#0D0F12',
    bgCard: '#161A20',
    bgCardAlt: '#1C2128',
    accent: '#39E97B',
    accentDim: '#39E97B18',
    accentBorder: '#39E97B44',
    blue: '#60A5FA',
    blueDim: '#60A5FA18',
    amber: '#F59E0B',
    amberDim: '#F59E0B18',
    orange: '#FB923C',
    orangeDim: '#FB923C18',
    danger: '#EF4444',
    dangerDim: '#EF444418',
    purple: '#A78BFA',
    purpleDim: '#A78BFA18',
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
  shadow: Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
    android: { elevation: 8 },
  }),
};

// ─────────────────────────────────────────────
// Interfaces  (unchanged)
// ─────────────────────────────────────────────
interface SelectedOption {
  group_id: number;
  option_id: number;
  group_name: string;
  option_name: string;
  price_delta: number;
  group_name_ar?: string;
  group_name_fr?: string;
  option_name_ar?: string;
  option_name_fr?: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  price: number;
  image?: string;
  // Size fields (present when item has a size selected)
  size_id?: string | null;
  size_name?: string | null;
  size_price?: number | null;
  // Options (present when item has add-ons/choices selected)
  options?: SelectedOption[] | null;
}

interface OrderDeal {
  deal_id: number;
  deal_name: string;
  quantity: number;
  deal_price: number;
  real_price_deal: number;
  image?: string | null;
}

interface Order {
  id: number;
  order_number: string;
  order_status: string;
  delivery_status?: string | null;
  delivery_address: string;
  final_price: number;
  delivery_fee?: number;
  payment_status: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  items: OrderItem[];
  deals?: OrderDeal[];
  order_type?: 'order' | 'deal' | 'both';
  delivery_man_id?: number | null;
  delivered_at?: string;
  assigned_at?: string;
  pick_up_at?: string;
  ready_for_delivery_at?: string;
  rating?: {
    id: number;
    rating: number;
    comment?: string;
    created_at: string;
  };
  lat?: number;
  lon?: number;
  restaurant_lat?: number;
  restaurant_lon?: number;
  restaurant_name?: string;
  restaurant_logo?: string;
  special_instructions?: string | null;
  estimated_preparing_time?: number | null;
  set_prepared_at?: string | null;
}

type TabType = 'accepted' | 'availableOrders' | 'delivered';
type MapType = 'delivery' | 'restaurant';

// ─────────────────────────────────────────────
// getPrettyStatus — now accepts translation object
// ─────────────────────────────────────────────
const getPrettyStatus = (
  order: Order,
  ot: ReturnType<typeof useLanguage>['t']['orders'],
) => {
  if (order.order_status === 'delivered' && order.delivery_status === 'delivered')
    return ot.statusDelivered;
  if (order.delivery_status === 'pick_up') return ot.statusOnRoad;
  if (order.delivery_status === 'assigned') {
    if (order.order_status === 'preparing') return ot.statusPreparing;
    if (order.order_status === 'accepted')  return ot.statusAssigned;
    return ot.statusAssigned;
  }
  if (order.order_status === 'accepted')  return ot.statusAccepted;
  if (order.order_status === 'preparing') return ot.statusPreparing;
  if (order.order_status === 'cancelled' || order.delivery_status === 'cancelled')
    return ot.statusCancelled;
  return order.order_status || ot.statusUnknown;
};

// ─────────────────────────────────────────────
// StatusBadge
// ─────────────────────────────────────────────
const StatusBadge = ({
  order,
  ot,
}: {
  order: Order;
  ot: ReturnType<typeof useLanguage>['t']['orders'];
}) => {
  const label = getPrettyStatus(order, ot);

  const getStatusConfig = () => {
    if (order.order_status === 'delivered' && order.delivery_status === 'delivered') {
      return { bg: DS.colors.accentDim, color: DS.colors.accent, border: DS.colors.accentBorder, icon: 'checkmark-circle-outline', label: ot.statusDelivered };
    }
    if (order.delivery_status === 'pick_up') {
      return { bg: DS.colors.blueDim, color: DS.colors.blue, border: DS.colors.blue + '44', icon: 'bicycle-outline', label: ot.statusOnRoad };
    }
    if (order.delivery_status === 'assigned') {
      return { bg: DS.colors.amberDim, color: DS.colors.amber, border: DS.colors.amber + '44', icon: 'time-outline', label };
    }
    if (order.order_status === 'cancelled' || order.delivery_status === 'cancelled') {
      return { bg: DS.colors.dangerDim, color: DS.colors.danger, border: DS.colors.danger + '44', icon: 'close-circle-outline', label: ot.statusCancelled };
    }
    return { bg: DS.colors.bgCardAlt, color: DS.colors.gray2, border: DS.colors.sep, icon: 'ellipse-outline', label };
  };

  const config = getStatusConfig();
  return (
    <View style={[sc.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[sc.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────
// ActionButton  (unchanged logic, no strings)
// ─────────────────────────────────────────────
const ActionButton = ({
  title, icon, onPress, variant = 'primary', loading = false, disabled = false,
}: {
  title: string; icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void; variant?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean; disabled?: boolean;
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':     return { bg: DS.colors.accent,    activeBg: '#2dd068',                  text: DS.colors.bg,     border: DS.colors.accent };
      case 'secondary':   return { bg: DS.colors.blueDim,   activeBg: DS.colors.blue + '30',      text: DS.colors.blue,   border: DS.colors.blue + '44' };
      case 'destructive': return { bg: DS.colors.dangerDim, activeBg: DS.colors.danger + '30',    text: DS.colors.danger, border: DS.colors.danger + '44' };
    }
  };
  const v = getVariantStyles();
  return (
    <Pressable
      style={({ pressed }) => [
        sc.actionBtn,
        { backgroundColor: pressed ? v.activeBg : v.bg, borderColor: v.border, opacity: disabled ? 0.5 : 1, transform: pressed ? [{ scale: 0.97 }] : [{ scale: 1 }] },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading
        ? <ActivityIndicator size="small" color={v.text} />
        : (<><Ionicons name={icon} size={16} color={v.text} /><Text style={[sc.actionBtnText, { color: v.text }]}>{title}</Text></>)
      }
    </Pressable>
  );
};

// ─────────────────────────────────────────────
// StatCard  (label comes from caller)
// ─────────────────────────────────────────────
const StatCard = ({ icon, value, label, color }: { icon: any; value: string; label: string; color: string }) => (
  <View style={[sc.statCard, DS.shadow]}>
    <View style={[sc.statIconWrap, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={18} color={color} />
    </View>
    <Text style={sc.statVal}>{value}</Text>
    <Text style={sc.statLbl}>{label}</Text>
  </View>
);

// ─────────────────────────────────────────────
// PlaceholderDots
// ─────────────────────────────────────────────
const PlaceholderDots = ({ length = 20 }: { length?: number }) => (
  <Text style={sc.dots}>{'•'.repeat(length)}</Text>
);

// ─────────────────────────────────────────────
// PrepCountdown
// ─────────────────────────────────────────────
const PrepCountdown = ({
  setPreparedAt,
  estimatedMinutes,
  createdAt,
}: {
  setPreparedAt?: string | null;
  estimatedMinutes: number;
  createdAt: string;
}) => {
  const startTime = setPreparedAt ? new Date(setPreparedAt).getTime() : new Date(createdAt).getTime();
  const targetTime = startTime + estimatedMinutes * 60 * 1000;

  const [remainingMs, setRemainingMs] = useState(targetTime - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(targetTime - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  const isOverdue = remainingMs <= 0;
  const absMs = Math.abs(remainingMs);
  const totalSeconds = Math.floor(absMs / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const timeLabel = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <View style={[sc.prepTimeBox, isOverdue && sc.prepTimeBoxOverdue]}>
      <Ionicons name={isOverdue ? 'alert-circle' : 'timer-outline'} size={14} color={isOverdue ? DS.colors.danger : DS.colors.amber} />
      <Text style={[sc.prepTimeText, isOverdue && { color: DS.colors.danger }]}>
        {isOverdue ? 'Overdue by ' : 'Ready in '}
        <Text style={[sc.prepTimeValue, isOverdue && { color: DS.colors.danger }]}>{timeLabel}</Text>
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────
// ImagePreviewModal
// ─────────────────────────────────────────────
const ImagePreviewModal = ({
  uri, visible, onClose,
}: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={sc.imagePreviewBackdrop} onPress={onClose}>
      <View style={[sc.imagePreviewCard, DS.shadow]}>
        <TouchableOpacity style={sc.imagePreviewCloseBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={DS.colors.white} />
        </TouchableOpacity>
        {uri && <Image source={{ uri }} style={sc.imagePreviewImage} resizeMode="contain" />}
      </View>
    </Pressable>
  </Modal>
);

// ─────────────────────────────────────────────
// OrderCard
// ─────────────────────────────────────────────
const OrderCard = React.memo(({
  order, showActions = true,
  onShowLocation, onShowRestaurantLocation,
  onAccept, onPickUp, onMarkDelivered,
  updatingStatus, tabType, ot, isRTL, hasActiveOrders,
}: {
  order: Order; showActions?: boolean;
  onShowLocation: (order: Order) => void;
  onShowRestaurantLocation?: (order: Order) => void;
  onAccept?: (id: number) => void;
  onPickUp?: (id: number) => void;
  onMarkDelivered?: (id: number) => void;
  updatingStatus?: number | null;
  tabType?: TabType;
  ot: ReturnType<typeof useLanguage>['t']['orders'];
  isRTL: boolean;
  hasActiveOrders?: boolean;
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const getPaymentIcon  = useCallback((ps: string) => (ps === 'Paid' ? 'card-outline' : 'cash-outline'), []);
  const getPaymentColor = useCallback((ps: string) => (ps === 'Paid' ? DS.colors.accent : DS.colors.orange), []);

  const isHidden = order.delivery_man_id == null;

  const showAcceptBtn   = tabType === 'availableOrders' && !!onAccept;
  const showPickUpBtn   = tabType === 'accepted' && order.delivery_status === 'assigned' && order.order_status === 'ready_for_delivery' && !!onPickUp;
  const showDeliveredBtn= tabType === 'accepted' && order.delivery_status === 'pick_up' && !!onMarkDelivered;
  const showRestaurantBtn= tabType === 'accepted' && order.delivery_status === 'assigned' && !!onShowRestaurantLocation;
  const showCustomerBtn = tabType === 'accepted' && order.delivery_status === 'pick_up';

  const activeButtonCount =
    (showAcceptBtn ? 1 : 0) + (showPickUpBtn ? 1 : 0) +
    (showDeliveredBtn ? 1 : 0) + (showRestaurantBtn ? 1 : 0) + (showCustomerBtn ? 1 : 0);

  const accentColor =
    order.delivery_status === 'pick_up'  ? DS.colors.blue  :
    order.delivery_status === 'assigned' ? DS.colors.amber :
    DS.colors.accent;

  // Payment label
  const paymentLabel = order.payment_status === 'Paid' ? ot.paid : ot.cashOnDelivery;

  return (
    <View style={[sc.card, DS.shadow]}>
      <View style={[sc.cardAccentBar, { backgroundColor: accentColor }]} />
      <View style={sc.cardBody}>
        <View style={[sc.cardHeader, isRTL && { flexDirection: 'row-reverse' }]}>
          <View style={sc.cardHeaderLeft}>
            <View style={[sc.orderNumRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="receipt-outline" size={13} color={DS.colors.accent} />
              <Text style={[sc.orderNum, isRTL && { textAlign: 'right' }]}>{order.order_number}</Text>
            </View>
            {isHidden
              ? <PlaceholderDots length={12} />
              : <Text style={[sc.customerName, isRTL && { textAlign: 'right' }]}>{order.customer_name || 'Customer'}</Text>
            }
          </View>
          <StatusBadge order={order} ot={ot} />
        </View>

        {(tabType === 'accepted' || tabType === 'availableOrders') && order.restaurant_name && (
          <View style={[sc.restaurantRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View style={sc.restaurantLogoWrap}>
              {order.restaurant_logo ? (
                <Image
                  source={{ uri: order.restaurant_logo.startsWith('http') ? order.restaurant_logo : `https://ubua.cloud/${order.restaurant_logo}` }}
                  style={sc.restaurantLogoImg}
                />
              ) : (
                <Ionicons name="restaurant-outline" size={16} color={DS.colors.accent} />
              )}
            </View>
            <Text style={[sc.restaurantName, isRTL && { textAlign: 'right' }]}>{order.restaurant_name}</Text>
          </View>
        )}

        {tabType === 'accepted' && order.order_status === 'preparing' && !!order.estimated_preparing_time && (
          <PrepCountdown
            setPreparedAt={order.set_prepared_at}
            estimatedMinutes={order.estimated_preparing_time}
            createdAt={order.created_at}
          />
        )}

        {!!order.special_instructions && order.special_instructions.trim() !== '' && (
          <View style={sc.instructionsBox}>
            <Ionicons name="alert-circle-outline" size={14} color={DS.colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={sc.instructionsLabel}>Special Instructions</Text>
              <Text style={[sc.instructionsText, isRTL && { textAlign: 'right' }]}>{order.special_instructions}</Text>
            </View>
          </View>
        )}

        {/* ── Items / Deals box ── */}
        {((order.items && order.items.length > 0) || (order.deals && order.deals.length > 0)) && (
          <View style={sc.itemsBox}>
            {/* Header row: shows total item count across both regular items and deals */}
            <View style={[sc.itemsHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="basket-outline" size={13} color={DS.colors.gray2} />
              <Text style={sc.itemsCount}>
                {ot.items(
                  (order.items?.length ?? 0) + (order.deals?.length ?? 0)
                )}
              </Text>
              {(order.order_type === 'deal' || order.order_type === 'both') && (
                <View style={sc.dealTypeBadge}>
                  <Ionicons name="pricetag-outline" size={10} color={DS.colors.purple} />
                  <Text style={sc.dealTypeBadgeText}>
                    {order.order_type === 'both' ? 'Deal + Items' : 'Deal'}
                  </Text>
                </View>
              )}
            </View>

            {isHidden ? (
              <PlaceholderDots length={30} />
            ) : (
              <>
                {/* ── Deals section ── */}
                {order.deals && order.deals.length > 0 && (
                  <View style={sc.dealsList}>
                    {order.deals.map((deal, idx) => (
                      <View
                        key={`deal-${deal.deal_id}-${idx}`}
                        style={[sc.dealRow, isRTL && { flexDirection: 'row-reverse' }]}
                      >
                        <TouchableOpacity
                          style={sc.dealIconWrap}
                          activeOpacity={deal.image ? 0.7 : 1}
                          onPress={() => {
                            if (!deal.image) return;
                            setPreviewImage(deal.image.startsWith('http') ? deal.image : `https://ubua.cloud/${deal.image}`);
                          }}
                        >
                          {deal.image ? (
                            <Image
                              source={{ uri: deal.image.startsWith('http') ? deal.image : `https://ubua.cloud/${deal.image}` }}
                              style={sc.dealImage}
                            />
                          ) : (
                            <Ionicons name="pricetag" size={11} color={DS.colors.purple} />
                          )}
                        </TouchableOpacity>
                        <View style={[sc.dealInfo, isRTL && { alignItems: 'flex-end' }]}>
                          <Text style={[sc.dealName, isRTL && { textAlign: 'right' }]}>
                            {deal.quantity}× Deal: {deal.deal_name}
                          </Text>
                          <View style={[sc.dealPriceRow, isRTL && { flexDirection: 'row-reverse' }]}>
                            {deal.real_price_deal !== deal.deal_price && (
                              <Text style={sc.dealOriginalPrice}>
                                {(Number(deal.real_price_deal) * deal.quantity).toFixed(2)} MAD
                              </Text>
                            )}
                            <Text style={sc.dealFinalPrice}>
                              {(Number(deal.deal_price) * deal.quantity).toFixed(2)} MAD
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Divider between deals and regular items */}
                {order.deals && order.deals.length > 0 && order.items && order.items.length > 0 && (
                  <View style={sc.itemsDealDivider} />
                )}

                {/* ── Regular items (with optional size) ── */}
                {order.items && order.items.length > 0 && (
                  <View style={sc.regularItemsList}>
                    {order.items.map((item, idx) => (
                      <View key={`item-${idx}`}>
                        <View style={[sc.regularItemRow, isRTL && { flexDirection: 'row-reverse' }]}>
                          <TouchableOpacity
                            style={sc.itemImageWrap}
                            activeOpacity={item.image ? 0.7 : 1}
                            onPress={() => {
                              if (!item.image) return;
                              setPreviewImage(item.image.startsWith('http') ? item.image : `https://ubua.cloud/${item.image}`);
                            }}
                          >
                            {item.image ? (
                              <Image
                                source={{ uri: item.image.startsWith('http') ? item.image : `https://ubua.cloud/${item.image}` }}
                                style={sc.itemImage}
                              />
                            ) : (
                              <Ionicons name="fast-food-outline" size={14} color={DS.colors.gray3} />
                            )}
                          </TouchableOpacity>
                          <Text style={[sc.regularItemName, isRTL && { textAlign: 'right' }]}>
                            {item.quantity}× {item.product_name}
                          </Text>
                          {item.size_name && (
                            <View style={sc.sizeBadge}>
                              <Text style={sc.sizeBadgeText}>{item.size_name}</Text>
                            </View>
                          )}
                          <Text style={sc.regularItemPrice}>
                            {(
                              ((Number(item.price) || 0) + (Number(item.size_price) || 0)) *
                              (Number(item.quantity) || 0)
                            ).toFixed(2)} MAD
                          </Text>
                        </View>
                        {item.options && item.options.length > 0 && (
                          <View style={[sc.optionsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                            {item.options.map((opt, oIdx) => (
                              <View key={`opt-${oIdx}`} style={sc.optionBadge}>
                                <Text style={sc.optionBadgeText}>
                                  {opt.option_name}
                                  {opt.price_delta ? ` (+${Number(opt.price_delta).toFixed(2)} MAD)` : ''}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={sc.detailsGrid}>
          <View style={[sc.detailRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Ionicons name="location-outline" size={15} color={DS.colors.gray3} />
            {isHidden
              ? <PlaceholderDots length={25} />
              : <Text style={[sc.detailText, isRTL && { textAlign: 'right' }]} numberOfLines={2}>
                  {order.delivery_address || ot.noAddress}
                </Text>
            }
          </View>

          {order.customer_phone && (
            <TouchableOpacity
              style={[sc.detailRow, isRTL && { flexDirection: 'row-reverse' }]}
              onPress={() => {
                if (isHidden) return;
                const phone = order.customer_phone.replace(/\s+/g, '');
                const url   = `tel:${phone}`;
                Linking.canOpenURL(url)
                  .then(supported => {
                    if (!supported) { Alert.alert(ot.alertCallError); return; }
                    // callTitle / callMsg are passed from the parent via ot
                    Alert.alert(ot.alertCallTitle, ot.alertCallMsg(order.customer_phone), [
                      { text: ot.alertCancelBtn },
                      { text: ot.alertCallBtn, onPress: () => Linking.openURL(url) },
                    ]);
                  })
                  .catch(() => Alert.alert(ot.alertCallFailed));
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={15} color={DS.colors.accent} />
              {isHidden
                ? <PlaceholderDots length={15} />
                : <Text style={[sc.detailText, { color: DS.colors.accent, fontWeight: '600' }, isRTL && { textAlign: 'right' }]}>
                    {order.customer_phone}
                  </Text>
              }
            </TouchableOpacity>
          )}
        </View>

        <View style={sc.financeWrap}>
  <View style={[sc.financeRow, isRTL && { flexDirection: 'row-reverse' }]}>
    <View style={[sc.paymentChip, isRTL && { flexDirection: 'row-reverse' }]}>
      <Ionicons
        name={getPaymentIcon(order.payment_status) as any}
        size={13}
        color={getPaymentColor(order.payment_status)}
      />
      <Text style={[sc.paymentText, { color: getPaymentColor(order.payment_status) }]}>
        {paymentLabel}
      </Text>
    </View>
  </View>

  {!isHidden ? (
    <View style={sc.priceBox}>
      <View style={[sc.priceRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={[sc.priceLabel, isRTL && { textAlign: 'right' }]}>
          {ot.itemsPriceLabel}
        </Text>
        <Text style={sc.priceValue}>
          {((Number(order.final_price) || 0) - (Number(order.delivery_fee) || 0)).toFixed(2)} MAD
        </Text>
      </View>
      <View style={[sc.priceRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={[sc.priceLabel, isRTL && { textAlign: 'right' }]}>
          {ot.deliveryFeeLabel}
        </Text>
        <Text style={sc.priceValue}>
          +{(Number(order.delivery_fee) || 0).toFixed(2)} MAD
        </Text>
      </View>
      <View style={sc.priceDivider} />
      <View style={[sc.priceRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={[sc.totalLabel, isRTL && { textAlign: 'right' }]}>
          {ot.totalLabel}
        </Text>
        <Text style={sc.totalValue}>
          {(Number(order.final_price) || 0).toFixed(2)} MAD
        </Text>
      </View>
    </View>
  ) : tabType === 'availableOrders' ? (
    // Show delivery fee even before the driver accepts (isHidden = true for unassigned orders)
    <View style={sc.priceBox}>
      <View style={[sc.priceRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={[sc.priceLabel, isRTL && { textAlign: 'right' }]}>
          {ot.deliveryFeeLabel}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="bicycle-outline" size={13} color={DS.colors.accent} />
          <Text style={[sc.totalValue, { fontSize: 14 }]}>
            {(Number(order.delivery_fee) || 0).toFixed(2)} MAD
          </Text>
        </View>
      </View>
    </View>
  ) : (
    <View style={sc.totalChip}>
      <PlaceholderDots length={8} />
    </View>
  )}
</View>

        {showActions && activeButtonCount > 0 && (
          <View style={[sc.actionRow, isRTL && { flexDirection: 'row-reverse' }]}>
            {showRestaurantBtn && (
              <ActionButton title={ot.restaurantBtn} icon="restaurant-outline" onPress={() => onShowRestaurantLocation!(order)} variant="secondary" />
            )}
            {showCustomerBtn && (
              <ActionButton title={ot.customerBtn} icon="map-outline" onPress={() => onShowLocation(order)} variant="secondary" />
            )}
            {showPickUpBtn && (
              <ActionButton title={ot.pickUp} icon="bag-handle-outline" onPress={() => onPickUp!(order.id)} variant="primary" loading={updatingStatus === order.id} disabled={updatingStatus === order.id} />
            )}
            {showDeliveredBtn && (
              <ActionButton title={ot.delivered} icon="checkmark-circle" onPress={() => onMarkDelivered!(order.id)} variant="primary" loading={updatingStatus === order.id} disabled={updatingStatus === order.id} />
            )}
            {showAcceptBtn && (
              <ActionButton title={ot.accept} icon="checkmark" onPress={() => onAccept!(order.id)} variant="primary" disabled={hasActiveOrders} />
            )}
          </View>
        )}

        {tabType === 'accepted' && order.delivery_status === 'assigned' && (
          <View style={sc.statusMsg}>
            <View style={sc.pulseDot} />
            <Text style={[sc.statusMsgText, isRTL && { textAlign: 'right' }]}>
              {order.order_status === 'ready_for_delivery' ? ot.msgReadyPickUp
                : order.order_status === 'preparing'      ? ot.msgPreparing
                : ot.msgWaiting}
            </Text>
          </View>
        )}

        {tabType === 'accepted' && order.delivery_status === 'pick_up' && (
          <View style={[sc.statusMsg, { backgroundColor: DS.colors.blueDim, borderColor: DS.colors.blue + '33' }]}>
            <View style={[sc.pulseDot, { backgroundColor: DS.colors.blue }]} />
            <Text style={[sc.statusMsgText, { color: DS.colors.blue }, isRTL && { textAlign: 'right' }]}>{ot.msgPickedUp}</Text>
          </View>
        )}
      </View>
      <ImagePreviewModal uri={previewImage} visible={!!previewImage} onClose={() => setPreviewImage(null)} />
    </View>
  );
});

// ─────────────────────────────────────────────
// DeliveredOrderCard
// ─────────────────────────────────────────────
const DeliveredOrderCard = React.memo(({
  order, ot, isRTL,
}: {
  order: Order;
  ot: ReturnType<typeof useLanguage>['t']['orders'];
  isRTL: boolean;
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  return (
  <View style={[sc.card, DS.shadow]}>
    <View style={[sc.cardAccentBar, { backgroundColor: DS.colors.accent }]} />
    <View style={sc.cardBody}>
      <View style={[sc.cardHeader, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={sc.cardHeaderLeft}>
          <View style={[sc.orderNumRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Ionicons name="receipt-outline" size={13} color={DS.colors.accent} />
            <Text style={sc.orderNum}>{order.order_number}</Text>
          </View>
          <Text style={[sc.customerName, isRTL && { textAlign: 'right' }]}>{order.customer_name || 'Customer'}</Text>
        </View>
        <View style={[sc.badge, { backgroundColor: DS.colors.accentDim, borderColor: DS.colors.accentBorder }]}>
          <Ionicons name="checkmark-circle-outline" size={12} color={DS.colors.accent} />
          <Text style={[sc.badgeText, { color: DS.colors.accent }]}>{ot.statusDelivered}</Text>
        </View>
      </View>

      {((order.items && order.items.length > 0) || (order.deals && order.deals.length > 0)) && (
        <View style={sc.itemsBox}>
          <View style={[sc.itemsHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Ionicons name="basket-outline" size={13} color={DS.colors.gray2} />
            <Text style={sc.itemsCount}>
              {ot.items((order.items?.length ?? 0) + (order.deals?.length ?? 0))}
            </Text>
            {(order.order_type === 'deal' || order.order_type === 'both') && (
              <View style={sc.dealTypeBadge}>
                <Ionicons name="pricetag-outline" size={10} color={DS.colors.purple} />
                <Text style={sc.dealTypeBadgeText}>
                  {order.order_type === 'both' ? 'Deal + Items' : 'Deal'}
                </Text>
              </View>
            )}
          </View>

          {/* Deals */}
          {order.deals && order.deals.length > 0 && (
            <View style={sc.dealsList}>
              {order.deals.map((deal, idx) => (
                <View key={`deal-${deal.deal_id}-${idx}`} style={[sc.dealRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={sc.dealIconWrap}>
                    {deal.image ? (
                      <Image
                        source={{ uri: deal.image.startsWith('http') ? deal.image : `https://ubua.cloud/${deal.image}` }}
                        style={sc.dealImage}
                      />
                    ) : (
                      <Ionicons name="pricetag" size={11} color={DS.colors.purple} />
                    )}
                  </View>
                  <View style={[sc.dealInfo, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={[sc.dealName, isRTL && { textAlign: 'right' }]}>
                      {deal.quantity}× Deal: {deal.deal_name}
                    </Text>
                    <View style={[sc.dealPriceRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      {deal.real_price_deal !== deal.deal_price && (
                        <Text style={sc.dealOriginalPrice}>
                          {(Number(deal.real_price_deal) * deal.quantity).toFixed(2)} MAD
                        </Text>
                      )}
                      <Text style={sc.dealFinalPrice}>
                        {(Number(deal.deal_price) * deal.quantity).toFixed(2)} MAD
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {order.deals && order.deals.length > 0 && order.items && order.items.length > 0 && (
            <View style={sc.itemsDealDivider} />
          )}

          {/* Regular items with optional sizes */}
          {order.items && order.items.length > 0 && (
            <View style={sc.regularItemsList}>
              {order.items.map((item, idx) => (
                <View key={`item-${idx}`} style={[sc.regularItemRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <View style={sc.itemImageWrap}>
                    {item.image ? (
                      <Image
                        source={{ uri: item.image.startsWith('http') ? item.image : `https://ubua.cloud/${item.image}` }}
                        style={sc.itemImage}
                      />
                    ) : (
                      <Ionicons name="fast-food-outline" size={14} color={DS.colors.gray3} />
                    )}
                  </View>
                  <Text style={[sc.regularItemName, isRTL && { textAlign: 'right' }]}>
                    {item.quantity}× {item.product_name}
                  </Text>
                  {item.size_name && (
                    <View style={sc.sizeBadge}>
                      <Text style={sc.sizeBadgeText}>
                        {item.size_name}
                        {item.size_price ? ` (+${Number(item.size_price).toFixed(2)} MAD)` : ''}
                      </Text>
                    </View>
                  )}
                  <Text style={sc.regularItemPrice}>
                    {(
  ((Number(item.price) || 0) + (Number(item.size_price) || 0)) *
  (Number(item.quantity) || 0)
).toFixed(2)} MAD
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={sc.detailsGrid}>
        <View style={[sc.detailRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <Ionicons name="location-outline" size={15} color={DS.colors.gray3} />
          <Text style={[sc.detailText, isRTL && { textAlign: 'right' }]} numberOfLines={2}>
            {order.delivery_address || ot.noAddress}
          </Text>
        </View>
        {order.delivered_at && (
          <View style={[sc.detailRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <Ionicons name="time-outline" size={15} color={DS.colors.gray3} />
            <Text style={sc.detailText}>
              {ot.deliveredOn(new Date(order.delivered_at).toLocaleDateString())}
            </Text>
          </View>
        )}
      </View>

      <View style={[sc.financeRow, isRTL && { flexDirection: 'row-reverse' }]}>
        <Text style={sc.feeText}>{ot.deliveryFeeLabel}</Text>
        <Text style={sc.totalText}>{(Number(order.delivery_fee) || 0).toFixed(2)} MAD</Text>
      </View>

      {order.rating ? (
        <View style={sc.ratingBox}>
          <View style={[sc.ratingStars, isRTL && { flexDirection: 'row-reverse' }]}>
            {[1, 2, 3, 4, 5].map(star => (
              <Ionicons key={star} name={star <= order.rating!.rating ? 'star' : 'star-outline'} size={15} color={DS.colors.amber} />
            ))}
            <Text style={sc.ratingVal}>{order.rating.rating}{ot.ratingOut}</Text>
          </View>
          {order.rating.comment && (
            <Text style={[sc.ratingComment, isRTL && { textAlign: 'right' }]}>"{order.rating.comment}"</Text>
          )}
        </View>
      ) : (
        <View style={sc.noRatingBox}>
          <Ionicons name="star-outline" size={15} color={DS.colors.gray3} />
          <Text style={sc.noRatingText}>{ot.noRatingYet}</Text>
        </View>
      )}
    </View>
    <ImagePreviewModal uri={previewImage} visible={!!previewImage} onClose={() => setPreviewImage(null)} />
  </View>
  );
});

// ─────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────
const SectionHeader = ({
  title, count, dotColor, pulse, isRTL,
}: {
  title: string; count: number; dotColor: string; pulse?: boolean; isRTL: boolean;
}) => (
  <View style={[sc.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
    <View style={[sc.sectionTitleRow, isRTL && { flexDirection: 'row-reverse' }]}>
      <View style={[sc.sectionDot, { backgroundColor: dotColor }]} />
      <Text style={sc.sectionTitle}>{title}</Text>
    </View>
    <View style={[sc.sectionBadge, pulse && { backgroundColor: DS.colors.amberDim }]}>
      {pulse && <View style={sc.pulseDot} />}
      <Text style={[sc.sectionBadgeText, pulse && { color: DS.colors.amber }]}>{count}</Text>
    </View>
  </View>
);

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
const ActiveOrdersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const ot = t.orders;
  const ct = t.common;

  const [activeTab, setActiveTab]         = useState<TabType>('accepted');
  const [orders, setOrders]               = useState<Order[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<Order[]>([]);
  const [pickedUpOrders, setPickedUpOrders] = useState<Order[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<Order[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showMap, setShowMap]             = useState(false);
  const [mapUrl, setMapUrl]               = useState<string>('');
  const [mapType, setMapType]             = useState<MapType>('delivery');
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const [stats, setStats]                 = useState({
    totalDeliveryFees: 0,
    avgRating:         0,
    avgDeliveryTime:   0,
    totalDeliveries:   0,
  });

  const fetchOrders = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) { setLoading(false); setRefreshing(false); return; }

      const [pendingResponse, assignedResponse, deliveredResponse] = await Promise.all([
        fetch('https://ubua.cloud/api/delivery/orders/pending', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('https://ubua.cloud/api/delivery/my-orders',      { headers: { Authorization: `Bearer ${token}` } }),
        fetch('https://ubua.cloud/api/delivery/delivered-orders',{ headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const rawPending = (pendingData.orders || []).filter((o: Order) => !o.delivery_man_id || o.delivery_man_id === null);
        // Normalise items to include size fields
        setOrders(rawPending.map((o: Order) => ({
          ...o,
          items: (o.items || []).map((item: any) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price ?? item.price_per_unit ?? 0),
            image: item.image,
            size_id: item.size_id ?? null,
            size_name: item.size_name ?? null,
            size_price: item.size_price != null ? parseFloat(item.size_price) : null,
            options: Array.isArray(item.options) ? item.options : [],
          })),
          deals: (o.deals || []).map((d: any) => ({
            deal_id: d.deal_id,
            deal_name: d.deal_name,
            quantity: d.quantity,
            deal_price: parseFloat(d.deal_price ?? 0),
            real_price_deal: parseFloat(d.real_price_deal ?? d.deal_price ?? 0),
            image: d.image ?? null,
          })),
        })));
      } else if (pendingResponse.status === 401) {
        Alert.alert(ct.sessionExpired, ct.sessionExpiredMsg);
        await AsyncStorage.removeItem('deliveryManToken'); return;
      }

      if (assignedResponse.ok) {
        const assignedData = await assignedResponse.json();
        const allAssigned  = assignedData.orders || [];
        const validAssigned = allAssigned
          .filter((o: Order) => o.delivery_man_id != null)
          .map((o: Order) => ({
            ...o,
            items: (o.items || []).map((item: any) => ({
              product_name: item.product_name,
              quantity: item.quantity,
              price: parseFloat(item.price ?? item.price_per_unit ?? 0),
              image: item.image,
              size_id: item.size_id ?? null,
            size_name: item.size_name ?? null,
            size_price: item.size_price != null ? parseFloat(item.size_price) : null,
            options: Array.isArray(item.options) ? item.options : [],
          })),
            deals: (o.deals || []).map((d: any) => ({
              deal_id: d.deal_id,
              deal_name: d.deal_name,
              quantity: d.quantity,
              deal_price: parseFloat(d.deal_price ?? 0),
              real_price_deal: parseFloat(d.real_price_deal ?? d.deal_price ?? 0),
              image: d.image ?? null,
            })),
          }));
        const isCancelled = (o: Order) =>
        o.order_status === 'cancelled' || o.delivery_status === 'cancelled';

        setAssignedOrders(validAssigned.filter((o: Order) =>
          o.delivery_status === 'assigned' &&
          o.order_status !== 'delivered' &&
          !isCancelled(o)
        ));
        setPickedUpOrders(validAssigned.filter((o: Order) =>
          o.delivery_status === 'pick_up' &&
          o.order_status !== 'delivered' &&
          !isCancelled(o)
        ));
      } else if (assignedResponse.status === 401) {
        Alert.alert(ct.sessionExpired, ct.sessionExpiredMsg);
        await AsyncStorage.removeItem('deliveryManToken'); return;
      }

      if (deliveredResponse.ok) {
        const deliveredData = await deliveredResponse.json();
        setDeliveredOrders((deliveredData.orders || []).map((o: Order) => ({
          ...o,
          items: (o.items || []).map((item: any) => ({
            product_name: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price ?? item.price_per_unit ?? 0),
            image: item.image,
            size_id: item.size_id ?? null,
            size_name: item.size_name ?? null,
            size_price: item.size_price != null ? parseFloat(item.size_price) : null,
            options: Array.isArray(item.options) ? item.options : [],
          })),
          deals: (o.deals || []).map((d: any) => ({
            deal_id: d.deal_id,
            deal_name: d.deal_name,
            quantity: d.quantity,
            deal_price: parseFloat(d.deal_price ?? 0),
            real_price_deal: parseFloat(d.real_price_deal ?? d.deal_price ?? 0),
            image: d.image ?? null,
          })),
        })));
      } else if (deliveredResponse.status === 401) {
        Alert.alert(ct.sessionExpired, ct.sessionExpiredMsg);
        await AsyncStorage.removeItem('deliveryManToken'); return;
      }

      try {
        const statsResponse = await fetch('https://ubua.cloud/api/delivery/stats', { headers: { Authorization: `Bearer ${token}` } });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats({
            totalDeliveryFees: statsData.total_delivery_fees || 0,
            avgRating:         statsData.avg_rating          || 0,
            avgDeliveryTime:   statsData.avg_delivery_time   || 0,
            totalDeliveries:   statsData.total_deliveries    || 0,
          });
        }
      } catch (statsError) {
        console.error('Error fetching stats:', statsError);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      if (!refreshing) Alert.alert(ct.error, ot.alertFetchError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

const updateLocation = useCallback(async () => {
  try {
    const token = await AsyncStorage.getItem('deliveryManToken');
    if (!token) return;

    // 1) Check device location services
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      console.log('Location services are disabled on this device');
      return;
    }

    // 2) Ask foreground permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Location permission not granted');
      return;
    }

    // 3) Try last known location first
    let location = await Location.getLastKnownPositionAsync();

    // 4) Fallback to a fresh GPS read
    if (!location) {
      location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
    }

    if (!location?.coords) {
      console.log('Could not get location coords');
      return;
    }

    await fetch('https://ubua.cloud/api/delivery/update-location', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }),
    });

    console.log(
      'Location updated:',
      location.coords.latitude,
      location.coords.longitude
    );
  } catch (error: any) {
    console.error('Error updating location:', error?.message || error);
  }
}, []);

  useEffect(() => {
    fetchOrders();
    const locationInterval = setInterval(updateLocation, 30000);
    updateLocation();
    return () => clearInterval(locationInterval);
  }, [fetchOrders, updateLocation]);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe('orders', fetchOrders, 3000);
    return unsubscribe;
  }, [fetchOrders]);
  useEffect(() => {
  const { DeviceEventEmitter } = require('react-native');
  const sub = DeviceEventEmitter.addListener('order_assigned', () => {
    setAlarmActive(true);
  });
  return () => sub.remove();
}, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  const handleStopAlarm = () => {
  DriverAlarm.stopAlarm();
  setAlarmActive(false);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

  const acceptOrder = async (orderId: number) => {
     if (assignedOrders.length > 0 || pickedUpOrders.length > 0) {
      Alert.alert(ot.alertActiveOrderTitle, ot.alertActiveOrderMsg);
      return;
    }
    const orderToAccept = orders.find(o => o.id === orderId);
    if (!orderToAccept) return;

    setOrders(prev => prev.filter(o => o.id !== orderId));
    setAssignedOrders(prev => [...prev, { ...orderToAccept, delivery_man_id: 1, delivery_status: 'assigned' }]);

    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        Alert.alert(ct.error, ct.authRequired);
        setOrders(prev => [...prev, orderToAccept]);
        setAssignedOrders(prev => prev.filter(o => o.id !== orderId));
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await fetch('https://ubua.cloud/api/delivery/accept-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: orderId }),
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(ot.alertOrderAssigned, ot.alertOrderAssignedMsg, [{ text: ct.ok }]);
        setActiveTab('accepted');
        fetchOrders();
      } else if (response.status === 401) {
        Alert.alert(ct.sessionExpired, ct.sessionExpiredMsg);
        await AsyncStorage.removeItem('deliveryManToken');
        setOrders(prev => [...prev, orderToAccept]);
        setAssignedOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        const data = await response.json().catch(() => ({ message: ot.alertOrderAcceptError }));
        Alert.alert(ct.error, data.message || ot.alertOrderAcceptError);
        setOrders(prev => [...prev, orderToAccept]);
        setAssignedOrders(prev => prev.filter(o => o.id !== orderId));
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert(ct.error, ct.networkError);
      setOrders(prev => [...prev, orderToAccept]);
      setAssignedOrders(prev => prev.filter(o => o.id !== orderId));
    }
  };

  const markAsPickedUp = async (orderId: number) => {
    try {
      setUpdatingStatus(orderId);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) { Alert.alert(ct.error, ct.authRequired); setUpdatingStatus(null); return; }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await fetch('https://ubua.cloud/api/delivery/update-order-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: orderId, status: 'pick_up' }),
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(ct.success, ot.alertPickUpSuccess, [{ text: ct.ok, onPress: fetchOrders }]);
      } else if (response.status === 401) {
        Alert.alert(ct.sessionExpired, ct.sessionExpiredMsg);
        await AsyncStorage.removeItem('deliveryManToken');
      } else {
        const data = await response.json().catch(() => ({ message: ot.alertUpdateError }));
        Alert.alert(ct.error, data.message || ot.alertUpdateError);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert(ct.error, ct.networkError);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const markAsDelivered = async (orderId: number) => {
    try {
      setUpdatingStatus(orderId);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) { Alert.alert(ct.error, ct.authRequired); setUpdatingStatus(null); return; }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await fetch('https://ubua.cloud/api/delivery/update-order-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: orderId, status: 'delivered' }),
      });

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(ct.success, ot.alertDeliveredSuccess, [{ text: ct.ok, onPress: fetchOrders }]);
      } else if (response.status === 401) {
        Alert.alert(ct.sessionExpired, ct.sessionExpiredMsg);
        await AsyncStorage.removeItem('deliveryManToken');
      } else {
        const data = await response.json().catch(() => ({ message: ot.alertUpdateError }));
        Alert.alert(ct.error, data.message || ot.alertUpdateError);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      Alert.alert(ct.error, ct.networkError);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleShowRestaurantLocation = async (order: Order) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!order.restaurant_lat || !order.restaurant_lon) {
        Alert.alert(ot.alertNoRestaurant); return;
      }
      setSelectedOrder(order); setMapType('restaurant');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMapUrl(`https://www.google.com/maps/search/?api=1&query=${order.restaurant_lat},${order.restaurant_lon}`);
        setShowMap(true); return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setMapUrl(`https://www.google.com/maps/dir/?api=1&origin=${location.coords.latitude},${location.coords.longitude}&destination=${order.restaurant_lat},${order.restaurant_lon}&travelmode=driving`);
      setShowMap(true);
    } catch (error) {
      console.error('Error showing restaurant location:', error);
      Alert.alert(ct.error, ot.alertNoRestaurant);
    }
  };

  const handleShowLocation = async (order: Order) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!order.delivery_address || order.delivery_address.trim() === '') {
        Alert.alert(ot.alertNoLocation, ot.alertNoLocationMsg); return;
      }
      setSelectedOrder(order); setMapType('delivery');
      const address    = encodeURIComponent(order.delivery_address.trim());
      const initialUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
      setMapUrl(initialUrl); setShowMap(true);

      (async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const location = await Location.getCurrentPositionAsync({});
            const currentLat = location.coords.latitude;
            const currentLng = location.coords.longitude;
            setMapUrl(order.lat && order.lon
              ? `https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${order.lat},${order.lon}&travelmode=driving`
              : `https://www.google.com/maps/dir/?api=1&origin=${currentLat},${currentLng}&destination=${address}&travelmode=driving`
            );
          }
        } catch (locError) {
          console.log('Could not get current location for directions:', locError);
        }
      })();
    } catch (error) {
      console.error('Error showing location:', error);
      Alert.alert(ct.error, 'Failed to show location');
    }
  };

  const renderSkeleton = () => (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.section}>{[1, 2, 3].map(item => <OrderCardSkeleton key={item} />)}</View>
    </ScrollView>
  );

  if (loading && orders.length === 0 && assignedOrders.length === 0 && pickedUpOrders.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={[DS.colors.headerTop, DS.colors.headerBot]} style={styles.topBar}>
          <View style={[styles.topBarRow, isRTL && { flexDirection: 'row-reverse' }]}>
            <View>
              <Text style={[styles.topBarEyebrow, isRTL && { textAlign: 'right' }]}>{t.common.eyebrow}</Text>
              <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>{ot.screenTitle}</Text>
            </View>
            <TouchableOpacity
              style={[styles.topBarIconWrap, { backgroundColor: DS.colors.dangerDim, borderColor: DS.colors.danger + '88' }]}
              onPress={handleStopAlarm}
              activeOpacity={0.7}
            >
              <Ionicons name="volume-mute" size={22} color={DS.colors.danger} />
            </TouchableOpacity>
          </View>
          <View style={styles.topBarAccentLine} />
        </LinearGradient>
        {renderSkeleton()}
      </View>
    );
  }

  const tabs: { key: TabType; icon: string; label: string; count: number }[] = [
    { key: 'accepted',       icon: 'bicycle',        label: ot.tabActive,    count: assignedOrders.length + pickedUpOrders.length },
    { key: 'availableOrders',icon: 'checkmark-circle',label: ot.tabAvailable, count: orders.length },
    { key: 'delivered',      icon: 'checkmark-done', label: ot.tabDone,      count: deliveredOrders.length },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: 70 }]}>
      <LinearGradient colors={[DS.colors.headerTop, DS.colors.headerBot]} style={styles.topBar}>
        {[0.33, 0.66].map(p => (
          <View key={p} style={[StyleSheet.absoluteFillObject, { borderLeftWidth: 1, borderLeftColor: '#39E97B05', left: `${p * 100}%` as any }]} pointerEvents="none" />
        ))}
        <View style={[styles.topBarRow, isRTL && { flexDirection: 'row-reverse' }]}>
          <View>
            <Text style={[styles.topBarEyebrow, isRTL && { textAlign: 'right' }]}>{t.common.eyebrow}</Text>
            <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>{ot.screenTitle}</Text>
          </View>
          <View style={[styles.topBarMeta, isRTL && { flexDirection: 'row-reverse' }]}>
            <TouchableOpacity
              style={[styles.topBarIconWrap, { marginRight: DS.sp.sm, backgroundColor: DS.colors.dangerDim, borderColor: DS.colors.danger + '88' }]}
              onPress={handleStopAlarm}
              activeOpacity={0.7}
            >
              <Ionicons name="volume-mute" size={20} color={DS.colors.danger} />
            </TouchableOpacity>
            <View style={styles.topBarChip}>
            <Ionicons name="checkmark-circle" size={13} color={DS.colors.accent} />
            <Text style={styles.topBarChipText}>{ot.activeChip(assignedOrders.length + pickedUpOrders.length)}</Text>
          </View>
          <View style={[styles.topBarChip, { marginLeft: DS.sp.sm }]}>
            <Ionicons name="checkmark-done" size={13} color={DS.colors.gray2} />
            <Text style={[styles.topBarChipText, { color: DS.colors.gray2 }]}>{ot.doneChip(deliveredOrders.length)}</Text>
          </View>
        </View>
        </View>
        <View style={styles.topBarAccentLine} />
      </LinearGradient>

      <View style={styles.statsStrip}>
        <StatCard icon="cash-outline"  value={`${stats.totalDeliveryFees.toFixed(2)} MAD`} label={ot.statTotalFees} color={DS.colors.accent} />
        <StatCard icon="star-outline"  value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : 'N/A'} label={ot.statAvgRating} color={DS.colors.amber} />
        <StatCard icon="time-outline"  value={stats.avgDeliveryTime > 0 ? `${Math.round(stats.avgDeliveryTime)}m` : 'N/A'} label={ot.statAvgTime} color={DS.colors.blue} />
      </View>

      <View style={[styles.tabBar, isRTL && { flexDirection: 'row-reverse' }]}>
        {tabs.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => { setActiveTab(tab.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              activeOpacity={0.7}
            >
              <Ionicons name={tab.icon as any} size={16} color={active ? DS.colors.accent : DS.colors.gray3} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              {tab.count > 0 && (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
          {renderSkeleton()}
        </ScrollView>
      ) : activeTab === 'delivered' ? (
        <FlashList
          style={styles.scroll}
          data={deliveredOrders}
          keyExtractor={(order) => String(order.id)}
          renderItem={({ item }) => <DeliveredOrderCard order={item} ot={ot} isRTL={isRTL} />}
          contentContainerStyle={{ paddingHorizontal: DS.sp.lg, paddingTop: DS.sp.xs, paddingBottom: insets.bottom + 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.colors.accent} colors={[DS.colors.accent]} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}><Ionicons name="checkmark-done" size={36} color={DS.colors.gray3} /></View>
              <Text style={styles.emptyTitle}>{ot.emptyDone}</Text>
              <Text style={styles.emptySub}>{ot.emptyDoneSub}</Text>
            </View>
          }
        />
      ) : activeTab === 'availableOrders' ? (
        <FlashList
          style={styles.scroll}
          data={orders}
          keyExtractor={(order) => String(order.id)}
          renderItem={({ item }) => (
            <OrderCard order={item} showActions onShowLocation={handleShowLocation}
              onShowRestaurantLocation={handleShowRestaurantLocation} onAccept={acceptOrder}
              updatingStatus={updatingStatus} tabType="availableOrders" ot={ot} isRTL={isRTL}
              hasActiveOrders={assignedOrders.length > 0 || pickedUpOrders.length > 0} />
          )}
          contentContainerStyle={{ paddingHorizontal: DS.sp.lg, paddingTop: DS.sp.xs, paddingBottom: insets.bottom + 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.colors.accent} colors={[DS.colors.accent]} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={orders.length > 0 ? <SectionHeader title={ot.sectionAvailable} count={orders.length} dotColor={DS.colors.accent} isRTL={isRTL} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}><Ionicons name="checkmark-circle" size={36} color={DS.colors.gray3} /></View>
              <Text style={styles.emptyTitle}>{ot.emptyAvailable}</Text>
              <Text style={styles.emptySub}>{ot.emptyAvailableSub}</Text>
            </View>
          }
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.colors.accent} colors={[DS.colors.accent]} />}
          showsVerticalScrollIndicator={false}
        >
          {pickedUpOrders.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={ot.sectionOnTheWay} count={pickedUpOrders.length} dotColor={DS.colors.blue} isRTL={isRTL} />
              {pickedUpOrders.map(order => (
                <OrderCard key={order.id} order={order} showActions onShowLocation={handleShowLocation}
                  onShowRestaurantLocation={handleShowRestaurantLocation} onMarkDelivered={markAsDelivered}
                  updatingStatus={updatingStatus} tabType="accepted" ot={ot} isRTL={isRTL} />
              ))}
            </View>
          )}
          {assignedOrders.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={ot.sectionAssigned} count={assignedOrders.length} dotColor={DS.colors.orange} pulse isRTL={isRTL} />
              {assignedOrders.map(order => (
                <OrderCard key={order.id} order={order} showActions onShowLocation={handleShowLocation}
                  onShowRestaurantLocation={handleShowRestaurantLocation} onPickUp={markAsPickedUp}
                  updatingStatus={updatingStatus} tabType="accepted" ot={ot} isRTL={isRTL} />
              ))}
            </View>
          )}
          {assignedOrders.length === 0 && pickedUpOrders.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}><Ionicons name="bicycle" size={36} color={DS.colors.gray3} /></View>
              <Text style={styles.emptyTitle}>{ot.emptyActive}</Text>
              <Text style={styles.emptySub}>{ot.emptyActiveSub}</Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        <View style={[styles.mapContainer, { paddingBottom: insets.bottom }]}>
          <View style={[styles.mapHeader, { paddingTop: insets.top + (Platform.OS === 'ios' ? 10 : 20) }]}>
            <TouchableOpacity onPress={() => { setShowMap(false); setSelectedOrder(null); }} style={styles.mapCloseBtn}>
              <Ionicons name="close" size={22} color={DS.colors.white} />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>
              {mapType === 'delivery' ? ot.mapDeliveryTitle : ot.mapRestaurantTitle}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <WebView
            source={{ uri: mapUrl }}
            style={styles.mapWebView}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
            renderLoading={() => (
              <View style={styles.mapLoadingWrap}>
                <ActivityIndicator size="large" color={DS.colors.accent} />
                <Text style={styles.mapLoadingText}>{ct.loadingMap}</Text>
              </View>
            )}
            onError={e => console.error('WebView error:', e.nativeEvent)}
            onHttpError={e => console.error('WebView HTTP error:', e.nativeEvent)}
            onLoadEnd={() => console.log('Map loaded successfully')}
            onShouldStartLoadWithRequest={request => {
              if (request.url.startsWith('intent://') || request.url.startsWith('geo:')) return false;
              return true;
            }}
          />

          {selectedOrder && (
            <View style={styles.mapInfo}>
              <View style={[styles.mapInfoHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={styles.mapInfoIcon}>
                  <Ionicons name={mapType === 'delivery' ? 'location' : 'restaurant'} size={22} color={DS.colors.danger} />
                </View>
                <View style={styles.mapInfoContent}>
                  {mapType === 'delivery' ? (
                    <>
                      <Text style={[styles.mapInfoAddress, isRTL && { textAlign: 'right' }]}>{selectedOrder.delivery_address}</Text>
                      <Text style={[styles.mapInfoSub, isRTL && { textAlign: 'right' }]}>{selectedOrder.customer_name} · {selectedOrder.customer_phone}</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.mapInfoAddress, isRTL && { textAlign: 'right' }]}>{ot.mapRestaurantTitle}</Text>
                      <Text style={[styles.mapInfoSub, isRTL && { textAlign: 'right' }]}>{ot.mapRestaurantOrder(selectedOrder.order_number)}</Text>
                      {selectedOrder.restaurant_lat && selectedOrder.restaurant_lon && (
                        <Text style={styles.mapInfoCoords}>{Number(selectedOrder.restaurant_lat).toFixed(6)}, {Number(selectedOrder.restaurant_lon).toFixed(6)}</Text>
                      )}
                    </>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.openMapsBtn}
                onPress={() => {
                  let url = '';
                  if (mapType === 'delivery') {
                    if (selectedOrder.lat && selectedOrder.lon) {
                      url = Platform.OS === 'ios'
                        ? `http://maps.apple.com/?daddr=${selectedOrder.lat},${selectedOrder.lon}&dirflg=d&t=m`
                        : `https://www.google.com/maps/dir/?api=1&destination=${selectedOrder.lat},${selectedOrder.lon}&travelmode=driving`;
                    } else {
                      const address = encodeURIComponent(selectedOrder.delivery_address);
                      url = Platform.OS === 'ios'
                        ? `http://maps.apple.com/?daddr=${address}&dirflg=d&t=m`
                        : `https://www.google.com/maps/dir/?api=1&destination=${address}&travelmode=driving`;
                    }
                  } else {
                    if (selectedOrder.restaurant_lat && selectedOrder.restaurant_lon) {
                      url = Platform.OS === 'ios'
                        ? `http://maps.apple.com/?daddr=${selectedOrder.restaurant_lat},${selectedOrder.restaurant_lon}&dirflg=d&t=m`
                        : `https://www.google.com/maps/dir/?api=1&destination=${selectedOrder.restaurant_lat},${selectedOrder.restaurant_lon}&travelmode=driving`;
                    } else {
                      Alert.alert(ct.error, ot.alertNoRestCoords); return;
                    }
                  }
                  Linking.openURL(url);
                }}
              >
                <Ionicons name="navigate" size={18} color={DS.colors.bg} />
                <Text style={styles.openMapsBtnText}>{ot.openInMaps}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────
// Styles  (all unchanged from original)
// ─────────────────────────────────────────────
const sc = StyleSheet.create({
  financeWrap: {
  borderTopWidth: 1,
  borderTopColor: DS.colors.sep,
  paddingTop: DS.sp.md,
  marginBottom: DS.sp.md,
},

priceBox: {
  gap: DS.sp.sm,
},

priceRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

priceLabel: {
  fontSize: 13,
  color: DS.colors.gray2,
  flex: 1,
},

priceValue: {
  fontSize: 13,
  color: DS.colors.gray1,
  fontWeight: '600',
},

priceDivider: {
  height: 1,
  backgroundColor: DS.colors.sep,
  marginVertical: 4,
},

totalLabel: {
  fontSize: 14,
  fontWeight: '700',
  color: DS.colors.white,
  flex: 1,
},

totalValue: {
  fontSize: 16,
  fontWeight: '800',
  color: DS.colors.accent,
},
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: DS.r.round, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: DS.r.md, borderWidth: 1, gap: 6, minHeight: 46 },
  actionBtnText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  statCard: { flex: 1, backgroundColor: DS.colors.bgCard, borderRadius: DS.r.md, padding: DS.sp.md, alignItems: 'center', borderWidth: 1, borderColor: DS.colors.sep },
  statIconWrap: { width: 32, height: 32, borderRadius: DS.r.sm, justifyContent: 'center', alignItems: 'center', marginBottom: DS.sp.sm },
  statVal: { fontSize: 14, fontWeight: '800', color: DS.colors.white, marginBottom: 2 },
  statLbl: { fontSize: 10, fontWeight: '600', color: DS.colors.gray3, letterSpacing: 0.5, textAlign: 'center' },
  dots: { fontSize: 14, color: DS.colors.gray3, letterSpacing: 2 },
  card: { flexDirection: 'row', backgroundColor: DS.colors.bgCard, borderRadius: DS.r.lg, marginBottom: DS.sp.md, borderWidth: 1, borderColor: DS.colors.sep, overflow: 'hidden' },
  cardAccentBar: { width: 3 },
  cardBody: { flex: 1, padding: DS.sp.lg, paddingBottom: DS.sp.xl },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: DS.sp.md },
  cardHeaderLeft: { flex: 1, marginRight: DS.sp.sm },
  orderNumRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  orderNum: { fontSize: 12, fontWeight: '600', color: DS.colors.accent, letterSpacing: -0.2 },
  customerName: { fontSize: 17, fontWeight: '700', color: DS.colors.white },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: DS.sp.sm, backgroundColor: DS.colors.bgCardAlt, borderRadius: DS.r.sm, padding: DS.sp.sm, marginBottom: DS.sp.md, borderWidth: 1, borderColor: DS.colors.sep },
  restaurantLogoWrap: { width: 30, height: 30, borderRadius: 15, backgroundColor: DS.colors.accentDim, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DS.colors.accentBorder },
  restaurantLogoImg: { width: 26, height: 26, borderRadius: 13 },
  restaurantName: { fontSize: 14, fontWeight: '600', color: DS.colors.gray1, flex: 1 },
  itemsBox: { backgroundColor: DS.colors.bgCardAlt, borderRadius: DS.r.sm, padding: DS.sp.md, marginBottom: DS.sp.md, borderWidth: 1, borderColor: DS.colors.sep },
  itemsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  itemsCount: { fontSize: 12, fontWeight: '600', color: DS.colors.gray2 },
  itemsSummary: { fontSize: 13, color: DS.colors.gray1, lineHeight: 18 },

  prepTimeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.colors.amberDim, borderWidth: 1, borderColor: DS.colors.amber + '44', borderRadius: DS.r.sm, paddingHorizontal: DS.sp.md, paddingVertical: DS.sp.sm, marginBottom: DS.sp.md },
  prepTimeBoxOverdue: { backgroundColor: DS.colors.dangerDim, borderColor: DS.colors.danger + '44' },
  prepTimeText: { fontSize: 13, color: DS.colors.gray1, fontWeight: '600' },
  prepTimeValue: { color: DS.colors.amber, fontWeight: '700' },

  instructionsBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: DS.colors.amberDim, borderWidth: 1, borderColor: DS.colors.amber + '44', borderRadius: DS.r.sm, padding: DS.sp.md, marginBottom: DS.sp.md },
  instructionsLabel: { fontSize: 10, fontWeight: '700', color: DS.colors.amber, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  instructionsText: { fontSize: 13, color: DS.colors.gray1, lineHeight: 18 },

  // Deal type badge (shown in items header)
  dealTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: DS.colors.purpleDim, paddingHorizontal: 7, paddingVertical: 2, borderRadius: DS.r.round, borderWidth: 1, borderColor: DS.colors.purple + '44', marginLeft: DS.sp.sm },
  dealTypeBadgeText: { fontSize: 10, fontWeight: '700', color: DS.colors.purple },

  // Deals list
  dealsList: { gap: DS.sp.xs, marginTop: DS.sp.xs },
  dealRow: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.sp.sm },
  dealIconWrap: { width: 28, height: 28, borderRadius: DS.r.sm, backgroundColor: DS.colors.purpleDim, justifyContent: 'center', alignItems: 'center', marginTop: 1, borderWidth: 1, borderColor: DS.colors.purple + '33', overflow: 'hidden' },
  dealImage: { width: 28, height: 28, borderRadius: DS.r.sm },
  dealInfo: { flex: 1 },
  dealName: { fontSize: 13, fontWeight: '600', color: DS.colors.white, lineHeight: 18 },
  dealPriceRow: { flexDirection: 'row', alignItems: 'center', gap: DS.sp.sm, marginTop: 2 },
  dealOriginalPrice: { fontSize: 11, color: DS.colors.gray3, textDecorationLine: 'line-through' },
  dealFinalPrice: { fontSize: 12, fontWeight: '700', color: DS.colors.purple },

  // Divider between deals and regular items
  itemsDealDivider: { height: 1, backgroundColor: DS.colors.sep, marginVertical: DS.sp.sm },

  // Regular items with size support
  regularItemsList: { gap: DS.sp.xs },
  regularItemRow: { flexDirection: 'row', alignItems: 'center', gap: DS.sp.sm, flexWrap: 'wrap' },
  regularItemName: { fontSize: 13, color: DS.colors.gray1, flex: 1, lineHeight: 18 },
  regularItemPrice: { fontSize: 12, fontWeight: '600', color: DS.colors.gray2 },

  // Size badge
  imagePreviewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', alignItems: 'center', padding: DS.sp.xl },
  imagePreviewCard: { width: '100%', maxWidth: 420, aspectRatio: 1, backgroundColor: DS.colors.bgCard, borderRadius: DS.r.xl, overflow: 'hidden', borderWidth: 1, borderColor: DS.colors.sep },
  imagePreviewImage: { width: '100%', height: '100%' },
  imagePreviewCloseBtn: { position: 'absolute', top: DS.sp.md, right: DS.sp.md, zIndex: 10, width: 34, height: 34, borderRadius: DS.r.round, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  itemImageWrap: { width: 28, height: 28, borderRadius: DS.r.sm, backgroundColor: DS.colors.bgCard, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: DS.colors.sep },
  itemImage: { width: 28, height: 28, borderRadius: DS.r.sm },
  sizeBadge: { backgroundColor: DS.colors.bgCardAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: DS.r.sm, borderWidth: 1, borderColor: DS.colors.sep },
  sizeBadgeText: { fontSize: 10, fontWeight: '700', color: DS.colors.blue },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2, marginBottom: 4 },
  optionBadge: { backgroundColor: DS.colors.purpleDim, paddingHorizontal: 6, paddingVertical: 2, borderRadius: DS.r.sm, borderWidth: 1, borderColor: DS.colors.purple + '33' },
  optionBadgeText: { fontSize: 10, fontWeight: '600', color: DS.colors.purple },
  detailsGrid: { gap: DS.sp.sm, marginBottom: DS.sp.md },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: DS.sp.sm },
  detailText: { flex: 1, fontSize: 13, color: DS.colors.gray1, lineHeight: 18 },
  financeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: DS.sp.sm, borderTopWidth: 1, borderTopColor: DS.colors.sep, paddingTop: DS.sp.md, marginBottom: DS.sp.md },
  paymentChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentText: { fontSize: 12, fontWeight: '600' },
  feeChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feeText: { fontSize: 12, color: DS.colors.gray2, fontWeight: '500' },
  totalChip: { marginLeft: 'auto' as any },
  totalText: { fontSize: 16, fontWeight: '800', color: DS.colors.accent },
  actionRow: { flexDirection: 'row', gap: DS.sp.sm, marginTop: DS.sp.xs },
  statusMsg: { flexDirection: 'row', alignItems: 'center', gap: DS.sp.sm, backgroundColor: DS.colors.amberDim, borderWidth: 1, borderColor: DS.colors.amber + '33', padding: DS.sp.md, borderRadius: DS.r.md, marginTop: DS.sp.md },
  pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: DS.colors.orange },
  statusMsgText: { flex: 1, fontSize: 12, color: DS.colors.amber, fontWeight: '500' },
  ratingBox: { backgroundColor: DS.colors.amberDim, borderRadius: DS.r.md, padding: DS.sp.md, marginTop: DS.sp.md, borderWidth: 1, borderColor: DS.colors.amber + '33' },
  ratingStars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 4 },
  ratingVal: { fontSize: 12, fontWeight: '700', color: DS.colors.white, marginLeft: 6 },
  ratingComment: { fontSize: 12, color: DS.colors.gray1, fontStyle: 'italic' },
  noRatingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DS.sp.sm, backgroundColor: DS.colors.bgCardAlt, borderRadius: DS.r.md, padding: DS.sp.md, marginTop: DS.sp.md, borderWidth: 1, borderColor: DS.colors.sep },
  noRatingText: { fontSize: 12, color: DS.colors.gray3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: DS.sp.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: DS.sp.sm },
  sectionDot: { width: 7, height: 7, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: DS.colors.gray1, letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.colors.bgCardAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: DS.r.round, borderWidth: 1, borderColor: DS.colors.sep },
  sectionBadgeText: { fontSize: 12, fontWeight: '700', color: DS.colors.gray2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.colors.bg },
  topBar: { paddingHorizontal: DS.sp.lg, paddingBottom: DS.sp.lg, paddingTop: DS.sp.sm, overflow: 'hidden' },
  topBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarEyebrow: { fontSize: 10, fontWeight: '700', color: DS.colors.accent, letterSpacing: 1.4, marginBottom: 2 },
  topBarTitle: { fontSize: 22, fontWeight: '800', color: DS.colors.white, letterSpacing: -0.5 },
  topBarIconWrap: { width: 40, height: 40, borderRadius: DS.r.md, backgroundColor: DS.colors.bgCardAlt, borderWidth: 1, borderColor: DS.colors.accentBorder, justifyContent: 'center', alignItems: 'center' },
  topBarMeta: { flexDirection: 'row', alignItems: 'center' },
  topBarChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.colors.accentDim, paddingHorizontal: DS.sp.sm, paddingVertical: DS.sp.xs, borderRadius: DS.r.round, borderWidth: 1, borderColor: DS.colors.accentBorder },
  topBarChipText: { fontSize: 11, fontWeight: '700', color: DS.colors.accent },
  topBarAccentLine: { height: 2, backgroundColor: DS.colors.accent, marginTop: DS.sp.md, borderRadius: 1, opacity: 0.6 },
  statsStrip: { flexDirection: 'row', gap: DS.sp.sm, paddingHorizontal: DS.sp.lg, paddingVertical: DS.sp.md, backgroundColor: DS.colors.bg },
  tabBar: { flexDirection: 'row', marginHorizontal: DS.sp.lg, marginBottom: DS.sp.md, backgroundColor: DS.colors.bgCard, borderRadius: DS.r.md, borderWidth: 1, borderColor: DS.colors.sep, padding: 3 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: DS.r.sm, gap: DS.sp.xs },
  tabActive: { backgroundColor: DS.colors.accentDim, borderWidth: 1, borderColor: DS.colors.accentBorder },
  tabText: { fontSize: 12, fontWeight: '600', color: DS.colors.gray3 },
  tabTextActive: { color: DS.colors.accent, fontWeight: '700' },
  tabBadge: { minWidth: 18, height: 18, borderRadius: DS.r.round, backgroundColor: DS.colors.bgCardAlt, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: DS.colors.accent },

  tabBadgeText: { fontSize: 10, fontWeight: '800', color: DS.colors.gray2 },
  tabBadgeTextActive: { color: DS.colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: DS.sp.lg, paddingTop: DS.sp.xs },
  section: { marginBottom: DS.sp.xl },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: DS.colors.bgCardAlt, justifyContent: 'center', alignItems: 'center', marginBottom: DS.sp.lg, borderWidth: 1, borderColor: DS.colors.sep },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DS.colors.gray1, marginBottom: DS.sp.sm },
  emptySub: { fontSize: 13, color: DS.colors.gray3, textAlign: 'center' },
  mapContainer: { flex: 1, backgroundColor: DS.colors.bg },
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DS.colors.headerTop, paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingBottom: DS.sp.lg, paddingHorizontal: DS.sp.lg, borderBottomWidth: 1, borderBottomColor: DS.colors.sep },
  mapCloseBtn: { width: 38, height: 38, borderRadius: DS.r.sm, backgroundColor: DS.colors.bgCardAlt, borderWidth: 1, borderColor: DS.colors.sep, justifyContent: 'center', alignItems: 'center' },
  mapHeaderTitle: { fontSize: 16, fontWeight: '700', color: DS.colors.white },
  mapWebView: { flex: 1 },
  mapLoadingWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.colors.bg },
  mapLoadingText: { marginTop: DS.sp.md, fontSize: 14, color: DS.colors.gray2, fontWeight: '500' },
  mapInfo: { backgroundColor: DS.colors.bgCard, paddingHorizontal: DS.sp.lg, paddingTop: DS.sp.lg, paddingBottom: DS.sp.lg + 4, borderTopWidth: 1, borderTopColor: DS.colors.sep },
  mapInfoHeader: { flexDirection: 'row', gap: DS.sp.md, marginBottom: DS.sp.md },
  mapInfoIcon: { width: 42, height: 42, borderRadius: DS.r.md, backgroundColor: DS.colors.dangerDim, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: DS.colors.danger + '33' },
  mapInfoContent: { flex: 1 },
  mapInfoAddress: { fontSize: 15, fontWeight: '700', color: DS.colors.white, marginBottom: 3, lineHeight: 20 },
  mapInfoSub: { fontSize: 13, color: DS.colors.gray2 },
  mapInfoCoords: { fontSize: 11, color: DS.colors.gray3, marginTop: 3 },
  openMapsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: DS.colors.accent, paddingVertical: 14, borderRadius: DS.r.md, gap: DS.sp.sm, ...Platform.select({ ios: { shadowColor: DS.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 }, android: { elevation: 6 } }) },
  openMapsBtnText: { color: DS.colors.bg, fontSize: 15, fontWeight: '700' },
});

export default ActiveOrdersScreen;