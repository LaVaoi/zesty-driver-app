// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useDeliveryManNotifications } from '@/hooks/useDeliveryManNotifications';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/constants/contexts/LanguageContext";

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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.tabBarInactive,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.label,
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
  tabBar: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    height: 68,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderRadius: RADIUS.xxl,
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
  },
  tabBarItem: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
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