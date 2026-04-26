import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageProvider } from '@/constants/contexts/LanguageContext';

function useProtectedRoute(isAuthenticated: boolean | null) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === null) return; // Still loading

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated and not on login → redirect to login
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Authenticated but on login → redirect to tabs
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);
}

export default function DeliveryLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('deliveryManToken');
      setIsAuthenticated(!!token);
    };
    checkAuth();

    // Listen for storage changes (login/logout)
    const interval = setInterval(async () => {
      const token = await AsyncStorage.getItem('deliveryManToken');
      setIsAuthenticated(!!token);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useProtectedRoute(isAuthenticated);

  return (
    <LanguageProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </LanguageProvider>
  );
}

