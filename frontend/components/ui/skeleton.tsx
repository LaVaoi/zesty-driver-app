import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#2A2D32',
          opacity,
        },
        style,
      ]}
    />
  );
};

// Profile Header Skeleton
export const ProfileHeaderSkeleton: React.FC = () => {
  return (
    <View style={styles.profileHeader}>
      <Skeleton width={100} height={100} borderRadius={50} />
      <Skeleton width={150} height={20} borderRadius={4} style={{ marginTop: 16 }} />
      <Skeleton width={200} height={14} borderRadius={4} style={{ marginTop: 8 }} />
    </View>
  );
};

// Order Card Skeleton
export const OrderCardSkeleton: React.FC = () => {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.orderHeaderLeft}>
          <Skeleton width={50} height={50} borderRadius={8} />
          <View style={styles.orderHeaderText}>
            <Skeleton width={120} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
            <Skeleton width={80} height={14} borderRadius={4} />
          </View>
        </View>
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>
      <View style={styles.orderItems}>
        <Skeleton width="100%" height={14} borderRadius={4} style={{ marginBottom: 4 }} />
        <Skeleton width="70%" height={14} borderRadius={4} />
      </View>
      <View style={styles.orderFooter}>
        <Skeleton width={100} height={16} borderRadius={4} />
        <Skeleton width={60} height={32} borderRadius={8} />
      </View>
    </View>
  );
};

// List Item Skeleton
export const ListItemSkeleton: React.FC = () => {
  return (
    <View style={styles.listItem}>
      <Skeleton width={50} height={50} borderRadius={25} />
      <View style={styles.listItemContent}>
        <Skeleton width="70%" height={16} borderRadius={4} style={{ marginBottom: 8 }} />
        <Skeleton width="50%" height={14} borderRadius={4} />
      </View>
      <Skeleton width={24} height={24} borderRadius={12} />
    </View>
  );
};

// Stats Card Skeleton
export const StatsCardSkeleton: React.FC = () => {
  return (
    <View style={styles.statsCard}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <Skeleton width={60} height={18} borderRadius={4} style={{ marginTop: 12 }} />
      <Skeleton width={80} height={14} borderRadius={4} style={{ marginTop: 4 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#1A1D21',
  },
  orderCard: {
    backgroundColor: '#2A2D32',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  orderItems: {
    marginBottom: 12,
    paddingLeft: 62,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3A3D42',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2A2D32',
    marginBottom: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  statsCard: {
    backgroundColor: '#2A2D32',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
});
