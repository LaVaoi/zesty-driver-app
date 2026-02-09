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
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarBackground: Platform.OS === 'ios' ? () => (
          <BlurView
            intensity={90}
            tint="light"
            style={styles.blurBackground}
          />
        ) : () => (
          <View style={styles.androidBackground} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedIcon
              name="home"
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
          title: "Notifications",
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
  const scale = useSharedValue(focused ? 1 : 0.9);
  const opacity = useSharedValue(focused ? 1 : 0.7);

  scale.value = withTiming(focused ? 1 : 0.9, { duration: 180 });
  opacity.value = withTiming(focused ? 1 : 0.7, { duration: 180 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
  const scale = useSharedValue(focused ? 1 : 0.9);
  const opacity = useSharedValue(focused ? 1 : 0.7);

  scale.value = withTiming(focused ? 1 : 0.9, { duration: 180 });
  opacity.value = withTiming(focused ? 1 : 0.7, { duration: 180 });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
    height: Platform.OS === 'ios' ? 85 : 70,
    paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    paddingTop: 12,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 231, 235, 0.8)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 231, 235, 0.5)',
  },

  androidBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(229, 231, 235, 0.8)',
  },

  label: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    letterSpacing: -0.2,
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
    top: -4,
    right: -6,
    backgroundColor: Colors.secondary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.9)',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },

  badgeSmall: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
  },

  badgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 10,
  },
});