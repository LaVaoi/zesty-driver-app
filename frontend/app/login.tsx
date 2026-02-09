import { useRouter } from "expo-router";
import { useFocusEffect } from '@react-navigation/native';
import React, { useState } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Pressable,
  Image,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { registerForPushNotificationsAsync } from "@/utils/notifications";

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#b4f349',
  primaryDark: '#8bc934',
  secondary: '#FF2A00',
  dark: '#1A1D21',
  darkLight: '#2A2D32',
  white: '#FFFFFF',
  darkText: '#1F2937',
  mediumText: '#6B7280',
  lightText: '#9CA3AF',
  inputBorder: '#E5E7EB',
  inputFocus: '#b4f349',
  error: '#FF2A00',
  gradientStart: '#1A1D21',
  gradientEnd: '#111315',
  gradientLightStart: '#F8F9FA',
  gradientLightEnd: '#F0F2F5',
};

const DeliveryManLogin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    React.useCallback(() => {
      const checkToken = async () => {
        const token = await AsyncStorage.getItem('deliveryManToken');
        if (token) router.replace('/(tabs)');
      };
      checkToken();
    }, [])
  );

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await fetch("https://ubua.cloud/api/auth/login-deliver-man", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response");
      }

      if (!response.ok) {
        Alert.alert("Login failed", data.message || "Invalid credentials.");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await AsyncStorage.setItem("deliveryManToken", data.token);
      await AsyncStorage.setItem("deliveryMan", JSON.stringify(data.deliveryMan));

      // ✅ Register for push notifications
      try {
        await registerForPushNotificationsAsync('delivery_man', data.deliveryMan.id);
        console.log('✅ Push notifications registered for delivery man');
      } catch (notifError) {
        console.error('⚠️ Push notification registration failed:', notifError);
        // Don't block login if notification registration fails
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");

    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert("Error", error.message || "Something went wrong.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? insets.top : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <LinearGradient
        colors={[COLORS.gradientLightStart, COLORS.gradientLightEnd]}
        style={styles.gradientBackground}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 20}
        >
          <ScrollView
            contentContainerStyle={[styles.container, { 
              paddingTop: Platform.OS === 'ios' ? insets.top + 20 : 40,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom + 20 : 32 
            }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Section */}
            <Animated.View
              entering={FadeInUp.delay(100).springify()}
              style={styles.header}
            >
              <Animated.View
                entering={FadeInUp.delay(200).springify()}
                style={styles.logoContainer}
              >
                <View style={styles.logoGradient}>
                  <Image
                    source={require('@/assets/images/zesty-driver-icon.png')}
                    style={styles.logoImage}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

                <Text style={styles.title}>
                  Zesty Driver
                </Text>

              <Text style={styles.subtitle}>
                Sign in to start delivering
              </Text>
            </Animated.View>

            {/* Form Section */}
            <Animated.View
              entering={FadeInUp.delay(300).springify()}
              style={styles.formContainer}
            >
              <Animated.View entering={FadeInDown.delay(400).springify()}>
                <Text style={styles.label}>
                  <MaterialIcons name="email" size={16} color={COLORS.mediumText} /> Email Address
                </Text>
                <View style={[
                  styles.inputContainer,
                  emailFocused && styles.inputContainerFocused
                ]}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={COLORS.lightText}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => {
                      setEmailFocused(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    onBlur={() => setEmailFocused(false)}
                    editable={!loading}
                  />
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(500).springify()}>
                <Text style={styles.label}>
                  <MaterialIcons name="lock" size={16} color={COLORS.mediumText} /> Password
                </Text>
                <View style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputContainerFocused
                ]}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Enter your password"
                    placeholderTextColor={COLORS.lightText}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => {
                      setPasswordFocused(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    onBlur={() => setPasswordFocused(false)}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setShowPassword(!showPassword);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={styles.eyeIcon}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color={COLORS.mediumText}
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>

              <Animated.View entering={FadeInDown.delay(600).springify()}>
                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
                  >
                    {loading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>Sign In</Text>
                        <MaterialIcons name="arrow-forward" size={20} color={COLORS.dark} style={{ marginLeft: 8 }} />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  gradientBackground: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Platform.OS === 'ios' ? 24 : 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: "center",
    marginBottom: Platform.OS === 'ios' ? 40 : 32,
    width: '100%',
    marginTop: Platform.OS === 'ios' ? 20 : 0,
  },
  logoContainer: {
    marginBottom: Platform.OS === 'ios' ? 24 : 20,
  },
  logoGradient: {
    width: Platform.OS === 'ios' ? 110 : 100,
    height: Platform.OS === 'ios' ? 110 : 100,
    borderRadius: Platform.OS === 'ios' ? 28 : 24,
    justifyContent: "center",
    alignItems: "center",
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 34 : 32,
    fontWeight: "bold",
    marginBottom: Platform.OS === 'ios' ? 12 : 8,
    color: COLORS.darkText,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Platform.OS === 'ios' ? 17 : 16,
    color: COLORS.mediumText,
    textAlign: 'center',
    paddingHorizontal: Platform.OS === 'ios' ? 24 : 20,
    lineHeight: Platform.OS === 'ios' ? 24 : 22,
  },
  formContainer: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: Platform.OS === 'ios' ? 28 : 24,
    padding: Platform.OS === 'ios' ? 28 : 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  label: {
    fontSize: Platform.OS === 'ios' ? 15 : 14,
    color: COLORS.darkText,
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
    fontWeight: '600',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: Platform.OS === 'ios' ? 58 : 56,
    borderWidth: Platform.OS === 'ios' ? 1.5 : 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: Platform.OS === 'ios' ? 14 : 12,
    paddingHorizontal: Platform.OS === 'ios' ? 18 : 16,
    marginBottom: Platform.OS === 'ios' ? 24 : 20,
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
    }),
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.darkText,
    padding: 0,
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
  loginButton: {
    width: '100%',
    borderRadius: Platform.OS === 'ios' ? 14 : 12,
    overflow: 'hidden',
    marginTop: Platform.OS === 'ios' ? 12 : 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loginButtonText: {
    color: COLORS.dark,
    fontSize: Platform.OS === 'ios' ? 18 : 17,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default DeliveryManLogin;

