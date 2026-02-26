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
  Image,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { registerForPushNotificationsAsync } from "@/utils/notifications";

const { width } = Dimensions.get('window');

const COLORS = {
  // Zesty Green (Primary)
  primary: '#b4f349',
  primaryDark: '#8bc934',
  primaryLight: '#c6f66b',

  // Zesty Orange (Secondary Accent)
  secondary: '#FF6B2A',
  secondaryLight: '#ff8f5c',

  // Neutrals
  dark: '#0F1215',
  darkLight: '#1E2227',
  white: '#FFFFFF',
  darkText: '#1A1E23',
  mediumText: '#6F767D',
  lightText: '#9AA3AB',
  inputBorder: '#E9ECEF',
  inputFocus: '#b4f349',
  error: '#FF3B30',
  success: '#34C759',

  // Background
  background: '#FFFFFF',
  cardBackground: '#FFFFFF',
};

// Subcomponents for better organization
const InputField = ({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  onTogglePassword,
  showPassword,
  focused,
  onFocus,
  onBlur,
  editable,
  keyboardType,
  isPassword = false
}: any) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.label}>
      <MaterialIcons name={icon} size={18} color={COLORS.mediumText} /> {label}
    </Text>
    <View style={[
      styles.inputContainer,
      focused && styles.inputContainerFocused
    ]}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.lightText}
        secureTextEntry={isPassword && !showPassword}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={onTogglePassword}
          style={styles.eyeIcon}
          activeOpacity={0.7}
        >
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={22}
            color={COLORS.mediumText}
          />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

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
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: Platform.OS === 'ios' ? insets.top + 20 : 40,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom + 30 : 32
            }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Premium Header Section */}
          <Animated.View
            entering={FadeInUp.delay(100).springify()}
            style={styles.header}
          >
            <View style={styles.logoOuterContainer}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Image
                  source={require('@/assets/images/zesty-driver-icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </LinearGradient>
            </View>

            <Text style={styles.title}>
              Zesty Driver
            </Text>

            <Text style={styles.subtitle}>
              Sign in to start delivering
            </Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View
            entering={FadeInUp.delay(200).springify()}
            style={styles.formCard}
          >
            <InputField
              label="Email Address"
              icon="email"
              value={email}
              onChangeText={setEmail}
              placeholder="driver@example.com"
              keyboardType="email-address"
              focused={emailFocused}
              onFocus={() => {
                setEmailFocused(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onBlur={() => setEmailFocused(false)}
              editable={!loading}
            />

            <InputField
              label="Password"
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              isPassword
              secureTextEntry
              showPassword={showPassword}
              onTogglePassword={() => {
                setShowPassword(!showPassword);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              focused={passwordFocused}
              onFocus={() => {
                setPasswordFocused(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              onBlur={() => setPasswordFocused(false)}
              editable={!loading}
            />

            {/* Forgot Password Link (preserved for future logic) */}
            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => {
                // Placeholder for future forgot password logic
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientButton}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Sign In</Text>
                    <View style={styles.buttonAccent}>
                      <MaterialIcons
                        name="arrow-forward"
                        size={20}
                        color={COLORS.dark}
                      />
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Help/Support Link */}
            <TouchableOpacity
              style={styles.supportLink}
              onPress={() => {
                // Placeholder for future support logic
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={18} color={COLORS.mediumText} />
              <Text style={styles.supportText}>
                Need help? Contact support
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Version Info (optional) */}
          <Text style={styles.versionText}>
            v1.0.0 • Delivery Partner App
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Platform.OS === 'ios' ? 24 : 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 32 : 28,
  },
  logoOuterContainer: {
    marginBottom: Platform.OS === 'ios' ? 20 : 16,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  logoGradient: {
    width: Platform.OS === 'ios' ? 100 : 90,
    height: Platform.OS === 'ios' ? 100 : 90,
    borderRadius: Platform.OS === 'ios' ? 25 : 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '70%',
    height: '70%',
    tintColor: COLORS.dark,
  },
  title: {
    fontSize: Platform.OS === 'ios' ? 36 : 34,
    fontWeight: '800',
    color: COLORS.darkText,
    letterSpacing: -0.5,
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Platform.OS === 'ios' ? 17 : 16,
    color: COLORS.mediumText,
    textAlign: 'center',
    lineHeight: Platform.OS === 'ios' ? 24 : 22,
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: Platform.OS === 'ios' ? 24 : 20,
    padding: Platform.OS === 'ios' ? 28 : 24,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  inputWrapper: {
    marginBottom: Platform.OS === 'ios' ? 20 : 18,
  },
  label: {
    fontSize: Platform.OS === 'ios' ? 15 : 14,
    fontWeight: '600',
    color: COLORS.darkText,
    marginBottom: Platform.OS === 'ios' ? 10 : 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Platform.OS === 'ios' ? 56 : 54,
    borderWidth: 1.5,
    borderColor: COLORS.inputBorder,
    borderRadius: Platform.OS === 'ios' ? 16 : 14,
    paddingHorizontal: Platform.OS === 'ios' ? 18 : 16,
    backgroundColor: COLORS.white,
  },
  inputContainerFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
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
    padding: 8,
    marginLeft: 8,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Platform.OS === 'ios' ? 28 : 24,
  },
  forgotPasswordText: {
    color: COLORS.primaryDark,
    fontSize: Platform.OS === 'ios' ? 15 : 14,
    fontWeight: '600',
  },
  loginButton: {
    width: '100%',
    borderRadius: Platform.OS === 'ios' ? 18 : 16,
    overflow: 'hidden',
    marginBottom: Platform.OS === 'ios' ? 20 : 18,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    paddingVertical: Platform.OS === 'ios' ? 18 : 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  loginButtonText: {
    color: COLORS.dark,
    fontSize: Platform.OS === 'ios' ? 18 : 17,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 8,
  },
  buttonAccent: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.9,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  supportText: {
    color: COLORS.mediumText,
    fontSize: Platform.OS === 'ios' ? 14 : 13,
    fontWeight: '500',
  },
  versionText: {
    textAlign: 'center',
    color: COLORS.lightText,
    fontSize: 12,
    marginTop: Platform.OS === 'ios' ? 24 : 20,
  },
});

export default DeliveryManLogin;