// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, Text, Platform, TouchableOpacity, NativeModules } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const { LocationTracking } = NativeModules;
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useDeliveryManNotifications } from '@/hooks/useDeliveryManNotifications';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/constants/contexts/LanguageContext";
import React from "react";

const COLORS = {
  background: '#0A0C0E',
  surface: '#1A1D21',
  surfaceElevated: '#252A2F',
  primary: '#84CC16',
  primaryDark: '#65A30D',
  text: '#FFFFFF',
  textSecondary: '#9AA1A9',
  textMuted: '#5F6B7A',
  border: '#2F353B',
  tabBarInactive: '#6B7280',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const RADIUS = {
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

const TYPOGRAPHY = {
  label: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  badge: {
    fontSize: 10,
    fontWeight: "800" as const,
    letterSpacing: -0.3,
    lineHeight: 12,
  },
};

const SHADOWS = {
  small: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
  medium: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    },
    android: {
      elevation: 8,
    },
  }),
  large: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    },
    android: {
      elevation: 16,
    },
  }),
};

export default function DeliveryTabsLayout() {
  const { unreadCount } = useDeliveryManNotifications();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [isActive, setIsActive] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;
      const response = await fetch('https://ubua.cloud/api/delivery/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setIsActive(!!data.deliveryMan?.is_active);
      }
    } catch (error) {
      console.error('Error fetching driver status:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleToggleOnline = async () => {
    if (statusLoading) return;
    try {
      setStatusLoading(true);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      const newStatus = isActive ? 0 : 1;

      await fetch('https://ubua.cloud/api/delivery/toggle-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: newStatus }),
      });

      if (newStatus === 1) {
        LocationTracking.startTracking(token, 'https://ubua.cloud/api/delivery/update-location');
      } else {
        LocationTracking.stopTracking();
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsActive(!!newStatus);
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setStatusLoading(false);
    }
  };


  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={[
          styles.statusToggleWrap,
          { bottom: insets.bottom + SPACING.sm + 64 + SPACING.sm, right: SPACING.lg },
        ]}
        onPress={handleToggleOnline}
        activeOpacity={0.85}
        disabled={statusLoading}
      >
        <Text style={[styles.statusToggleLabel, { color: isActive ? COLORS.primary : '#EF4444' }]}>
          {isActive ? 'ONLINE' : 'OFFLINE'}
        </Text>
        <View style={[
          styles.statusTrack,
          isActive ? styles.statusTrackActive : styles.statusTrackInactive,
        ]}>
          <View style={[
            styles.statusThumb,
            isActive ? styles.statusThumbActive : styles.statusThumbInactive,
          ]}>
            <Ionicons
              name={isActive ? 'power' : 'power-outline'}
              size={14}
              color={isActive ? COLORS.background : '#9AA1A9'}
            />
          </View>
        </View>
      </TouchableOpacity>
      {insets.bottom > 0 && (
        <View
          pointerEvents="none"
          style={[styles.navBarScrim, { height: insets.bottom }]}
        />
      )}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelPosition: 'below-icon',
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.tabBarInactive,
          tabBarStyle: [
  styles.tabBar,
  {
    bottom: insets.bottom + SPACING.sm,
    height: 64,
    paddingBottom: 0,
  },
],
tabBarLabelStyle: {
  fontSize: 11,
  fontWeight: '500',
  marginTop: 2,
  lineHeight: 14,
},
          tabBarLabel: ({ focused, color, children }) => (
  <Text
    style={[styles.label, { color }]}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.85}
  >
    {children}
  </Text>
),
          tabBarBackground: () => (
            <BlurView
              intensity={100}
              tint="dark"
              style={styles.tabBarBackground}
            />
          ),
          tabBarItemStyle: styles.tabBarItem,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t.tabs.home,
            tabBarLabel: t.tabs.home,
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedIcon
                name="home-outline"
                focusedName="home"
                size={size}
                color={color}
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="orders"
          options={{
            title: t.tabs.orders,
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedIcon
                name="cube-outline"
                focusedName="cube"
                size={size}
                color={color}
                focused={focused}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="notifications"
          options={{
            title: t.tabs.alerts,
            tabBarIcon: ({ color, size, focused }) => (
              <NotificationIconWithBadge
                color={color}
                size={size}
                focused={focused}
                unreadCount={unreadCount}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: t.tabs.profile,
            tabBarIcon: ({ color, size, focused }) => (
              <AnimatedIcon
                name="person-outline"
                focusedName="person"
                size={size}
                color={color}
                focused={focused}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

function AnimatedIcon({
  name,
  focusedName,
  size,
  color,
  focused
}: {
  name: string;
  focusedName: string;
  size: number;
  color: string;
  focused: boolean;
}) {
  const scale = useSharedValue(focused ? 1 : 0.95);
  const opacity = useSharedValue(focused ? 1 : 0.6);
  const translateY = useSharedValue(focused ? -2 : 0);

  scale.value = withTiming(focused ? 1 : 0.95, { duration: 200 });
  opacity.value = withTiming(focused ? 1 : 0.6, { duration: 200 });
  translateY.value = withTiming(focused ? -2 : 0, { duration: 200 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, styles.iconWrapper]}>
      <Ionicons
        name={focused ? (focusedName as any) : (name as any)}
        size={size}
        color={color}
      />
    </Animated.View>
  );
}

function NotificationIconWithBadge({ color, size, focused, unreadCount }: {
  color: string;
  size: number;
  focused: boolean;
  unreadCount: number;
}) {
  const scale = useSharedValue(focused ? 1 : 0.95);
  const opacity = useSharedValue(focused ? 1 : 0.6);
  const translateY = useSharedValue(focused ? -2 : 0);

  scale.value = withTiming(focused ? 1 : 0.95, { duration: 200 });
  opacity.value = withTiming(focused ? 1 : 0.6, { duration: 200 });
  translateY.value = withTiming(focused ? -2 : 0, { duration: 200 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[animatedStyle, styles.iconWrapper]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={focused ? "notifications" : "notifications-outline"}
          size={size}
          color={color}
        />
        {unreadCount > 0 && (
          <View style={[
            styles.badge,
            unreadCount > 9 && styles.badgeSmall
          ]}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  navBarScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.background,
    zIndex: 10,
  },
  statusToggleWrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xxl,
    backgroundColor: 'rgba(26, 29, 33, 0.92)',
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 20,
    ...SHADOWS.medium,
  },
  statusToggleLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.6,
  },
  statusTrack: {
    width: 52,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  statusTrackActive: {
    backgroundColor: '#84CC1633',
    alignItems: 'flex-end',
  },
  statusTrackInactive: {
    backgroundColor: '#2F353B',
    alignItems: 'flex-start',
  },
  statusThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  statusThumbActive: {
    backgroundColor: COLORS.primary,
  },
  statusThumbInactive: {
    backgroundColor: '#3A4149',
  },
  tabBar: {
  position: 'absolute',
  left: SPACING.lg,
  right: SPACING.lg,
  backgroundColor: 'transparent',
  borderTopWidth: 0,
  borderRadius: RADIUS.lg,
  paddingTop: SPACING.sm,
  ...SHADOWS.large,
  overflow: 'hidden',
},
  tabBarBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 29, 33, 0.9)',
  },
  label: {
    ...TYPOGRAPHY.label,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif-medium',
    marginTop: SPACING.xs,
    width: '100%',
    textAlign: 'center',
    includeFontPadding: false,
  },
  tabBarItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    borderWidth: 2,
    borderColor: COLORS.surfaceElevated,
    ...SHADOWS.small,
  },
  badgeSmall: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.md,
  },
  badgeText: {
    ...TYPOGRAPHY.badge,
    color: COLORS.background,
    textAlign: 'center',
  },
});