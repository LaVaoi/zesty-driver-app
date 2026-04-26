// app/login.tsx
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
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
import { registerForPushNotificationsAsync } from '@/utils/notifications';
import { useLanguage } from '@/constants/contexts/LanguageContext';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────
// Original COLORS (unchanged)
// ─────────────────────────────────────────────
const COLORS = {
  primary:        '#b4f349',
  primaryDark:    '#8bc934',
  primaryLight:   '#c6f66b',
  secondary:      '#FF6B2A',
  secondaryLight: '#ff8f5c',
  dark:           '#0F1215',
  darkLight:      '#1E2227',
  white:          '#FFFFFF',
  darkText:       '#1A1E23',
  mediumText:     '#6F767D',
  lightText:      '#9AA3AB',
  inputBorder:    '#E9ECEF',
  inputFocus:     '#b4f349',
  error:          '#FF3B30',
  success:        '#34C759',
  background:     '#FFFFFF',
  cardBackground: '#FFFFFF',
};

// ─────────────────────────────────────────────
// Driver Console Design Tokens (unchanged)
// ─────────────────────────────────────────────
const C = {
  bg:           '#0D0F12',
  bgCard:       '#161A20',
  bgCardAlt:    '#1C2128',
  bgInput:      '#111419',
  accent:       '#39E97B',
  accentDim:    '#39E97B14',
  accentBorder: '#39E97B50',
  white:        '#FFFFFF',
  g1:           '#E8EAED',
  g2:           '#9CA3AF',
  g3:           '#4B5563',
  g4:           '#2D3340',
  sep:          '#1F2937',
  inputBorder:  '#252D3A',
  inputFocus:   '#39E97B',
};

const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const R  = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 26, round: 999 };

const CARD_SHADOW = Platform.select({
  ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.55, shadowRadius: 28 },
  android: { elevation: 14 },
});
const GLOW_SHADOW = Platform.select({
  ios:     { shadowColor: '#39E97B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 18 },
  android: { elevation: 8 },
});
const LOGO_SHADOW = Platform.select({
  ios:     { shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 },
  android: { elevation: 12 },
});

// ─────────────────────────────────────────────
// InputField
// ─────────────────────────────────────────────
const InputField = ({
  label, icon, value, onChangeText, placeholder,
  onTogglePassword, showPassword, focused, onFocus, onBlur,
  editable, keyboardType, isPassword = false, isRTL = false,
}: any) => (
  <View style={styles.inputWrapper}>
    <View style={[styles.labelRow, isRTL && { flexDirection: 'row-reverse' }]}>
      <View style={[styles.labelIconWrap, focused && styles.labelIconWrapFocused]}>
        <MaterialIcons name={icon} size={13} color={focused ? C.accent : C.g3} />
      </View>
      <Text style={[styles.label, focused && styles.labelFocused, isRTL && { textAlign: 'right' }]}>
        {label.toUpperCase()}
      </Text>
    </View>

    <View style={[styles.inputContainer, focused && styles.inputContainerFocused]}>
      <TextInput
        style={[styles.input, isRTL && { textAlign: 'right' }]}
        placeholder={placeholder}
        placeholderTextColor={C.g4}
        secureTextEntry={isPassword && !showPassword}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={C.accent}
        textAlign={isRTL ? 'right' : 'left'}
      />
      {isPassword && (
        <TouchableOpacity onPress={onTogglePassword} style={styles.eyeIcon} activeOpacity={0.7}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={focused ? C.accent : C.g3} />
        </TouchableOpacity>
      )}
    </View>

    <View style={[styles.inputUnderline, focused && styles.inputUnderlineFocused]} />
  </View>
);

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
const DeliveryManLogin: React.FC = () => {
  const [loading, setLoading]                 = useState(false);
  const router                                = useRouter();
  const [email, setEmail]                     = useState('said@gmail.com');
  const [password, setPassword]               = useState('said123');
  const [showPassword, setShowPassword]       = useState(false);
  const [emailFocused, setEmailFocused]       = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const insets                                = useSafeAreaInsets();

  const { t, isRTL } = useLanguage();
  const lt = t.login;
  const ct = t.common;

useEffect(() => {
  const checkToken = async () => {
    const token = await AsyncStorage.getItem('deliveryManToken');
    if (token) router.replace('/(tabs)');
  };
  checkToken();
}, []); // runs only once on mount, not on every focus

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(lt.missingFields, lt.missingFieldsMsg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const response = await fetch('https://ubua.cloud/api/auth/login-deliver-man', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); }
      catch { throw new Error(lt.invalidResponse); }

      if (!response.ok) {
        Alert.alert(lt.loginFailed, data.message || lt.invalidCredentials);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await AsyncStorage.setItem('deliveryManToken', data.token);
      await AsyncStorage.setItem('deliveryMan', JSON.stringify(data.deliveryMan));

      try {
        await registerForPushNotificationsAsync('delivery_man', data.deliveryMan.id);
      } catch (notifError) {
        console.error('Push notification registration failed:', notifError);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');

    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(ct.error, error.message || lt.somethingWrong);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: Platform.OS === 'ios' ? insets.top : 0 }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Background decoration */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {[0.25, 0.5, 0.75].map(p => (
          <View key={p} style={[styles.bgGridV, { left: `${p * 100}%` as any }]} />
        ))}
        {[0.35, 0.65].map(p => (
          <View key={p} style={[styles.bgGridH, { top: `${p * 100}%` as any }]} />
        ))}
        <View style={styles.bgBloom} />
        <View style={styles.bgBloomBottom} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop:    Platform.OS === 'ios' ? insets.top + 20 : 40,
              paddingBottom: Platform.OS === 'ios' ? insets.bottom + 30 : 32,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ═══════════ BRAND AREA ═══════════ */}
          <Animated.View entering={FadeInUp.delay(80).springify()} style={styles.header}>
            <View style={[styles.logoOuter, LOGO_SHADOW]}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoGradient}>
                <Image source={require('../assets/images/zesty-driver-icon.png')} style={styles.logoImage} resizeMode="contain" />
              </LinearGradient>
            </View>

            <Text style={[styles.title, isRTL && { textAlign: 'center' }]}>{lt.title}</Text>
            <Text style={[styles.subtitle, isRTL && { textAlign: 'center' }]}>{lt.subtitle}</Text>

            <View style={styles.secureChip}>
              <View style={styles.secureChipLed} />
              <Text style={styles.secureChipText}>{lt.secureLogin}</Text>
            </View>
          </Animated.View>

          {/* ═══════════ FORM CARD ═══════════ */}
          <Animated.View entering={FadeInUp.delay(180).springify()} style={[styles.formCard, CARD_SHADOW]}>
            <View style={styles.cardStripe} />

            <View style={[styles.cardEyebrow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="log-in-outline" size={14} color={C.accent} />
              <Text style={[styles.cardEyebrowText, isRTL && { textAlign: 'right' }]}>{lt.driverAuth}</Text>
            </View>

            <InputField
              label={lt.emailLabel}
              icon="email"
              value={email}
              onChangeText={setEmail}
              placeholder={lt.emailPlaceholder}
              keyboardType="email-address"
              focused={emailFocused}
              onFocus={() => { setEmailFocused(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              onBlur={() => setEmailFocused(false)}
              editable={!loading}
              isRTL={isRTL}
            />

            <InputField
              label={lt.passwordLabel}
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder={lt.passwordPlaceholder}
              isPassword
              secureTextEntry
              showPassword={showPassword}
              onTogglePassword={() => { setShowPassword(!showPassword); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              focused={passwordFocused}
              onFocus={() => { setPasswordFocused(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              onBlur={() => setPasswordFocused(false)}
              editable={!loading}
              isRTL={isRTL}
            />

            <TouchableOpacity
              style={[styles.forgotPassword, isRTL && { alignSelf: 'flex-start' }]}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>{lt.forgotPassword}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled, GLOW_SHADOW]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.9}
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientButton}>
                {loading ? (
                  <ActivityIndicator color={COLORS.dark} size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>{lt.signIn}</Text>
                    <View style={styles.buttonAccent}>
                      <MaterialIcons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={COLORS.dark} />
                    </View>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.sep}>
              <View style={styles.sepLine} />
              <View style={styles.sepDot} />
              <View style={styles.sepLine} />
            </View>
          </Animated.View>

          {/* ═══════════ FOOTER ═══════════ */}
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.footer}>
            <Text style={styles.versionText}>{ct.version}</Text>
          </Animated.View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────
// StyleSheet (all unchanged)
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  bgGridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#39E97B07' },
  bgGridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#39E97B04' },
  bgBloom: { position: 'absolute', top: -180, alignSelf: 'center', width: 360, height: 360, borderRadius: 180, backgroundColor: '#39E97B0B' },
  bgBloomBottom: { position: 'absolute', bottom: -120, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: '#39E97B06' },
  container: { flexGrow: 1, paddingHorizontal: Platform.OS === 'ios' ? 24 : 20, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: Platform.OS === 'ios' ? 36 : 28 },
  logoOuter: { marginBottom: Platform.OS === 'ios' ? 22 : 18 },
  logoGradient: { width: Platform.OS === 'ios' ? 96 : 88, height: Platform.OS === 'ios' ? 96 : 88, borderRadius: Platform.OS === 'ios' ? 24 : 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoImage: { width: 140, height: 140 },
  title: { fontSize: Platform.OS === 'ios' ? 36 : 33, fontWeight: '800', color: C.white, letterSpacing: -0.8, marginBottom: Platform.OS === 'ios' ? 8 : 6, textAlign: 'center' },
  subtitle: { fontSize: Platform.OS === 'ios' ? 16 : 15, color: C.g2, textAlign: 'center', lineHeight: 22, marginBottom: SP.md, paddingHorizontal: 20 },
  secureChip: { flexDirection: 'row', alignItems: 'center', gap: SP.sm - 2, backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder, paddingHorizontal: SP.md, paddingVertical: SP.xs + 2, borderRadius: R.round },
  secureChipLed: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  secureChipText: { fontSize: 10, fontWeight: '800', color: C.accent, letterSpacing: 1.5 },

  formCard: { backgroundColor: C.bgCard, borderRadius: Platform.OS === 'ios' ? 26 : 22, padding: Platform.OS === 'ios' ? 28 : 24, width: '100%', borderWidth: 1, borderColor: C.sep, overflow: 'hidden' },
  cardStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: C.accent, opacity: 0.9 },
  cardEyebrow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.xl, marginTop: SP.sm },
  cardEyebrowText: { fontSize: 11, fontWeight: '700', color: C.g3, letterSpacing: 1.4 },

  inputWrapper: { marginBottom: Platform.OS === 'ios' ? 22 : 20 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm },
  labelIconWrap: { width: 22, height: 22, borderRadius: R.sm, backgroundColor: C.bgCardAlt, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.sep },
  labelIconWrapFocused: { backgroundColor: C.accentDim, borderColor: C.accentBorder },
  label: { fontSize: 11, fontWeight: '700', color: C.g3, letterSpacing: 1.2 },
  labelFocused: { color: C.accent },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: Platform.OS === 'ios' ? 54 : 52, borderWidth: 1.5, borderColor: C.inputBorder, borderRadius: R.lg, paddingHorizontal: Platform.OS === 'ios' ? 16 : 14, backgroundColor: C.bgInput },
  inputContainerFocused: { borderColor: C.inputFocus, borderWidth: 2, ...Platform.select({ ios: { shadowColor: C.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 10 } }) },
  input: { flex: 1, fontSize: 16, color: C.white, padding: 0, fontWeight: '500' },
  eyeIcon: { padding: 6, marginLeft: 6 },
  inputUnderline: { height: 1, backgroundColor: C.inputBorder, marginTop: 4, borderRadius: 1, opacity: 0.35 },
  inputUnderlineFocused: { backgroundColor: C.accent, opacity: 0.55 },

  forgotPassword: { alignSelf: 'flex-end', marginBottom: Platform.OS === 'ios' ? 28 : 24, marginTop: -(SP.sm) },
  forgotPasswordText: { color: C.accent, fontSize: Platform.OS === 'ios' ? 14 : 13, fontWeight: '600' },

  loginButton: { width: '100%', borderRadius: Platform.OS === 'ios' ? 18 : 16, overflow: 'hidden', marginBottom: Platform.OS === 'ios' ? 20 : 18 },
  loginButtonDisabled: { opacity: 0.65 },
  gradientButton: { paddingVertical: Platform.OS === 'ios' ? 18 : 16, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SP.sm },
  loginButtonText: { color: COLORS.dark, fontSize: Platform.OS === 'ios' ? 17 : 16, fontWeight: '800', letterSpacing: 0.4 },
  buttonAccent: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.18)', justifyContent: 'center', alignItems: 'center' },

  sep: { flexDirection: 'row', alignItems: 'center', gap: SP.sm, marginBottom: SP.sm },
  sepLine: { flex: 1, height: 1, backgroundColor: C.sep },
  sepDot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: C.g4 },

  supportLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SP.sm, paddingVertical: Platform.OS === 'ios' ? 10 : 8 },
  supportText: { color: C.g3, fontSize: Platform.OS === 'ios' ? 13 : 12, fontWeight: '500' },

  footer: { alignItems: 'center', marginTop: Platform.OS === 'ios' ? 28 : 22 },
  versionText: { textAlign: 'center', color: C.g4, fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
});

export default DeliveryManLogin;