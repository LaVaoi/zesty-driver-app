// app/delivery/tabs/_layout.tsx
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
import Colors from '@/constants/Colors';

export default function DeliveryTabsLayout() {
  const { unreadCount } = useDeliveryManNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarBackground: Platform.OS === 'ios' ? () => (
          <BlurView
            intensity={100}
            tint="light"
            style={styles.blurBackground}
          />
        ) : () => (
          <View style={styles.androidBackground} />
        ),
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
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
          title: "Orders",
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
          title: "Alerts",
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
          title: "Profile",
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
  );
}

/** Animated Icon Component */
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

/** Notification Icon with Badge Component */
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
  tabBar: {
    height: Platform.OS === 'ios' ? 88 : 68,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 10,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#FFFFFF',
    borderTopWidth: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'absolute',
    overflow: 'hidden',
  },

  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderTopWidth: 0,
  },

  androidBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
  },

  label: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif-medium',
  },

  tabBarItem: {
    paddingVertical: 4,
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  badgeSmall: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 10,
  },

  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 12,
    letterSpacing: -0.3,
  },
});