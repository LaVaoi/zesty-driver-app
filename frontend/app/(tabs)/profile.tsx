// app/(tabs)/profile.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Colors from '@/constants/Colors';
import { ProfileHeaderSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Language } from '@/constants/translation';
import { useLanguage } from '@/constants/contexts/LanguageContext';

// ===================== Design Tokens (unchanged) =====================
const T = {
  colors: {
    bg: '#0D0F12',
    bgCard: '#161A20',
    bgCardAlt: '#1C2128',
    accent: '#39E97B',
    accentDim: '#39E97B22',
    accentBorder: '#39E97B44',
    danger: '#EF4444',
    dangerDim: '#EF444420',
    amber: '#F59E0B',
    amberDim: '#F59E0B20',
    white: '#FFFFFF',
    gray1: '#E8EAED',
    gray2: '#9CA3AF',
    gray3: '#4B5563',
    gray4: '#1F2937',
    separator: '#1F2937',
    headerGrad1: '#0D0F12',
    headerGrad2: '#161A20',
    greenGrad1: '#39E97B',
    greenGrad2: '#22C55E',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, round: 999 },
  shadow: {
    card: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    glow: { shadowColor: '#39E97B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  },
  typography: {
    heroName:    { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    title:       { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.3 },
    sectionTitle:{ fontSize: 13, fontWeight: '700' as const, letterSpacing: 1.2 },
    statValue:   { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },
    statLabel:   { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.5 },
    label:       { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.6 },
    value:       { fontSize: 15, fontWeight: '500' as const },
    body:        { fontSize: 14, fontWeight: '400' as const },
    caption:     { fontSize: 12, fontWeight: '500' as const },
  },
};

// ===================== Interfaces =====================
interface DeliveryMan {
  id: number;
  name: string;
  email: string;
  phone: string;
  vehicle_type: string;
  license_number: string;
  image?: string | null;
  is_active: number;
  current_latitude: number | null;
  current_longitude: number | null;
  last_location_update: string | null;
  created_at: string;
}

// ===================== Sub Components =====================

const StatCard = ({
  icon, value, label, accent,
}: {
  icon: string; value: string | number; label: string; accent?: string;
}) => {
  const color = accent || T.colors.accent;
  return (
    <View style={[styles.statCard, T.shadow.card]}>
      <View style={[styles.statAccentBar, { backgroundColor: color }]} />
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: T.colors.white }]}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
};

const SectionHeader = ({
  title, icon, isRTL,
}: {
  title: string; icon?: string; isRTL: boolean;
}) => (
  <View style={[styles.sectionHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
    {icon && (
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon as any} size={14} color={T.colors.accent} />
      </View>
    )}
    <Text style={[styles.sectionTitle, isRTL && { textAlign: 'right' }]}>{title.toUpperCase()}</Text>
  </View>
);

const InfoRow = ({
  icon, label, value,
  editable = false, onChangeText,
  inputType = 'text', options,
  isLast = false, isRTL = false,
  placeholder,
}: {
  icon: string; label: string; value: string | number | null;
  editable?: boolean; onChangeText?: (text: string) => void;
  inputType?: 'text' | 'select'; options?: string[];
  isLast?: boolean; isRTL?: boolean; placeholder?: string;
}) => {
  if (editable && inputType === 'select' && options) {
    return (
      <View style={[styles.infoRow, !isLast && styles.infoRowBorder, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon as any} size={16} color={T.colors.accent} />
        </View>
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, isRTL && { textAlign: 'right' }]}>{label.toUpperCase()}</Text>
          <View style={[styles.selectContainer, isRTL && { flexDirection: 'row-reverse' }]}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.selectOption, value === option && styles.selectOptionActive]}
                onPress={() => onChangeText?.(option)}
              >
                <Text style={[styles.selectOptionText, value === option && styles.selectOptionTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }

  if (editable) {
    return (
      <View style={[styles.infoRow, !isLast && styles.infoRowBorder, isRTL && { flexDirection: 'row-reverse' }]}>
        <View style={styles.infoIconWrap}>
          <Ionicons name={icon as any} size={16} color={T.colors.accent} />
        </View>
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, isRTL && { textAlign: 'right' }]}>{label.toUpperCase()}</Text>
          <TextInput
            style={[styles.infoInput, isRTL && { textAlign: 'right' }]}
            value={value?.toString() || ''}
            onChangeText={onChangeText}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            placeholderTextColor={T.colors.gray3}
            selectionColor={T.colors.accent}
            textAlign={isRTL ? 'right' : 'left'}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder, isRTL && { flexDirection: 'row-reverse' }]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon as any} size={16} color={T.colors.accent} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, isRTL && { textAlign: 'right' }]}>{label.toUpperCase()}</Text>
        <Text style={[styles.infoValue, isRTL && { textAlign: 'right' }]}>{value || 'Not available'}</Text>
      </View>
    </View>
  );
};

const VerificationBadge = ({
  status, verifiedLabel, pendingLabel, missingLabel,
}: {
  status: 'verified' | 'pending' | 'missing';
  verifiedLabel: string; pendingLabel: string; missingLabel: string;
}) => {
  const config = {
    verified: { icon: 'checkmark-circle', color: T.colors.accent,  text: verifiedLabel },
    pending:  { icon: 'time',             color: T.colors.amber,   text: pendingLabel },
    missing:  { icon: 'alert-circle',     color: T.colors.danger,  text: missingLabel },
  };
  const { icon, color, text } = config[status];
  return (
    <View style={[styles.verificationBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Ionicons name={icon as any} size={12} color={color} />
      <Text style={[styles.verificationText, { color }]}>{text}</Text>
    </View>
  );
};

// ─── Language Selector Row ───────────────────────────────────────────────────
const LanguageSelector = ({
  language, setLanguage, pt, isRTL,
}: {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  pt: ReturnType<typeof useLanguage>['t']['profile'];
  isRTL: boolean;
}) => {
  const options: { code: Language; label: string }[] = [
    { code: 'en', label: pt.langEnglish },
    { code: 'ar', label: pt.langArabic  },
  ];

  return (
    <View style={[styles.infoRow, styles.infoRowLast, isRTL && { flexDirection: 'row-reverse' }]}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="language-outline" size={16} color={T.colors.accent} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, isRTL && { textAlign: 'right' }]}>
          {pt.languageLabel.toUpperCase()}
        </Text>
        <View style={[styles.selectContainer, isRTL && { flexDirection: 'row-reverse' }, { marginTop: T.spacing.sm }]}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt.code}
              style={[styles.selectOption, language === opt.code && styles.selectOptionActive]}
              onPress={async () => {
                if (language !== opt.code) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  await setLanguage(opt.code);
                }
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.selectOptionText, language === opt.code && styles.selectOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

// ===================== Main Screen =====================
const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router  = useRouter();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const pt = t.profile;
  const ct = t.common;
  const isMounted = useRef(true);

useEffect(() => {
  isMounted.current = true;
  return () => { isMounted.current = false; };
}, []);

  const [deliveryMan, setDeliveryMan]       = useState<DeliveryMan | null>(null);
  const [loading, setLoading]               = useState(true);
  const [isEditing, setIsEditing]           = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  const [formData, setFormData] = useState({
    name:           '',
    email:          '',
    phone:          '',
    vehicle_type:   'Motorcycle',
    license_number: '',
  });
  const [image, setImage] = useState<string | null>(null);

  // Vehicle type options are not translated (they are backend values)
  const vehicleTypes = ['Bicycle', 'Motorcycle', 'Car', 'Van'];

  const fetchProfile = useCallback(async () => {
  try {
    const token = await AsyncStorage.getItem('deliveryManToken');
    if (!token) {
      if (isMounted.current) router.replace('/login');
      return;
    }

    try {
      const response = await fetch('https://ubua.cloud/api/delivery/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (!isMounted.current) return;
        setDeliveryMan(data.deliveryMan);
        setFormData({
          name:           data.deliveryMan.name           || '',
          email:          data.deliveryMan.email          || '',
          phone:          data.deliveryMan.phone          || '',
          vehicle_type:   data.deliveryMan.vehicle_type   || 'Motorcycle',
          license_number: data.deliveryMan.license_number || '',
        });
        setImage(data.deliveryMan.image || null);
        await AsyncStorage.setItem('deliveryMan', JSON.stringify(data.deliveryMan));
      } else if (response.status === 401) {
        if (isMounted.current) router.replace('/login');
        return;
      } else {
        const cachedData = await AsyncStorage.getItem('deliveryMan');
        if (cachedData && isMounted.current) {
          const parsed = JSON.parse(cachedData);
          setDeliveryMan(parsed);
          setFormData({
            name:           parsed.name           || '',
            email:          parsed.email          || '',
            phone:          parsed.phone          || '',
            vehicle_type:   parsed.vehicle_type   || 'Motorcycle',
            license_number: parsed.license_number || '',
          });
          setImage(parsed.image || null);
        }
      }
    } catch (fetchError) {
      const cachedData = await AsyncStorage.getItem('deliveryMan');
      if (cachedData && isMounted.current) {
        const parsed = JSON.parse(cachedData);
        setDeliveryMan(parsed);
        setFormData({
          name:           parsed.name           || '',
          email:          parsed.email          || '',
          phone:          parsed.phone          || '',
          vehicle_type:   parsed.vehicle_type   || 'Motorcycle',
          license_number: parsed.license_number || '',
        });
        setImage(parsed.image || null);
      }
    }
  } catch (error) {
    console.error('Error in fetchProfile:', error);
  } finally {
    if (isMounted.current) setLoading(false);
  }
}, [router]);

const updateLocation = useCallback(async () => {
  try {
    const token = await AsyncStorage.getItem('deliveryManToken');
    if (!token) return;

    // 1) Check if device location services are enabled
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      console.log('Location services are disabled on this device');
      return;
    }

    // 2) Ask for foreground permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Location permission not granted');
      return;
    }

    // 3) Try last known location first
    let location = await Location.getLastKnownPositionAsync();

    // 4) Fallback to fresh GPS location
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
    fetchProfile();
    const locationInterval = setInterval(updateLocation, 30000);
    updateLocation();
    return () => clearInterval(locationInterval);
  }, [fetchProfile, updateLocation]);

  const handleLogout = () => {
    Alert.alert(pt.alertLogoutTitle, pt.alertLogoutMsg, [
      { text: ct.cancel, style: 'cancel' },
      {
        text: pt.alertLogoutBtn,
        style: 'destructive',
        onPress: async () => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            isMounted.current = false; // ← add this FIRST
            await AsyncStorage.multiRemove(['deliveryManToken', 'deliveryMan']);
            router.replace('/login');
          } catch (error) {
            console.error('Error during logout:', error);
            isMounted.current = true;
          }
        },
      },
    ]);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(pt.alertPermissionDenied, pt.alertCameraPermission); return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(pt.alertPermissionDenied, pt.alertLibraryPermission); return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      }
      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        setAvatarModalVisible(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(pt.alertPickImageTitle, pt.alertPickImageFail);
    }
  };

  const removeImage = () => {
    Alert.alert(pt.removePhotoTitle, pt.removePhotoConfirm, [
      { text: ct.cancel, style: 'cancel' },
      {
        text: pt.removeBtn, style: 'destructive',
        onPress: () => {
          setImage(null);
          setAvatarModalVisible(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) { Alert.alert(ct.error, ct.authRequired); return; }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const formDataToSend = new FormData();
      formDataToSend.append('name',           formData.name);
      formDataToSend.append('email',          formData.email);
      formDataToSend.append('phone',          formData.phone);
      formDataToSend.append('vehicle_type',   formData.vehicle_type);
      formDataToSend.append('license_number', formData.license_number);

      if (image) {
        if (image.startsWith('file://') || !image.startsWith('http')) {
          const filename = image.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type  = match ? `image/${match[1]}` : 'image/jpeg';
          formDataToSend.append('image', { uri: image, name: filename, type } as any);
        } else {
          formDataToSend.append('image', '');
        }
      } else {
        formDataToSend.append('image', '');
      }

      const response = await fetch('https://ubua.cloud/api/delivery/update-profile', {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body:    formDataToSend,
      });

      if (response.ok) {
        const data = await response.json();
        setDeliveryMan(data.deliveryMan);
        setImage(data.deliveryMan.image || null);
        await AsyncStorage.setItem('deliveryMan', JSON.stringify(data.deliveryMan));
        setIsEditing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(ct.success, pt.alertSaveSuccess);
        fetchProfile();
      } else {
        const errorData = await response.json();
        Alert.alert(ct.error, errorData.message || pt.alertSaveFail);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(ct.error, pt.alertSomethingWrong);
    } finally {
      setSaving(false);
    }
  };

  // ---- Skeleton ----
  const renderSkeleton = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroContainer}>
        <Skeleton width={100} height={100} borderRadius={50} />
        <Skeleton width={180} height={26} borderRadius={6} style={{ marginTop: 16 }} />
        <Skeleton width={130} height={14} borderRadius={4} style={{ marginTop: 8 }} />
        <Skeleton width={90}  height={28} borderRadius={14} style={{ marginTop: 12 }} />
      </View>
      <View style={styles.statsRow}>
        <Skeleton width="31%" height={88} borderRadius={T.radius.md} />
        <Skeleton width="31%" height={88} borderRadius={T.radius.md} />
        <Skeleton width="31%" height={88} borderRadius={T.radius.md} />
      </View>
      <Skeleton width="100%" height={200} borderRadius={T.radius.lg} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={160} borderRadius={T.radius.lg} style={{ marginBottom: 16 }} />
    </ScrollView>
  );

  if (loading && !deliveryMan) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>{pt.screenTitle}</Text>
          <View style={styles.skeletonIcon} />
        </View>
        {renderSkeleton()}
      </View>
    );
  }

  if (!deliveryMan) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={T.colors.gray3} />
        <Text style={styles.errorText}>{pt.alertFetchFail}</Text>
      </View>
    );
  }

  const displayImage = image
    ? (image.startsWith('http') || image.startsWith('file://'))
      ? image
      : `https://ubua.cloud/uploads/deliveryManImages/${image.replace(/\\/g, '/')}`
    : null;
  const documentStatus: 'verified' | 'pending' | 'missing' = 'verified';
  const isActive = !!deliveryMan.is_active;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: 70 }]}>

      {/* ── Top Bar ── */}
      <LinearGradient colors={[T.colors.headerGrad1, T.colors.headerGrad2]} style={styles.topBar}>
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {[0.2, 0.5, 0.8].map(p => (
            <View key={p} style={[StyleSheet.absoluteFillObject, { borderLeftWidth: 1, borderLeftColor: '#39E97B06', left: `${p * 100}%` as any }]} />
          ))}
        </View>

        <View style={[styles.topBarInner, isRTL && { flexDirection: 'row-reverse' }]}>
          <View>
            <Text style={[styles.topBarEyebrow, isRTL && { textAlign: 'right' }]}>{pt.eyebrow}</Text>
            <Text style={[styles.topBarTitle, isRTL && { textAlign: 'right' }]}>
              {isEditing ? pt.editTitle : pt.screenTitle}
            </Text>
          </View>
          <View style={[styles.topBarActions, isRTL && { flexDirection: 'row-reverse' }]}>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.iconBtn} activeOpacity={0.7}>
                <Ionicons name="create-outline" size={20} color={T.colors.white} />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => { setIsEditing(false); fetchProfile(); }} style={styles.iconBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color={T.colors.gray2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={[styles.iconBtn, styles.iconBtnAccent]} disabled={saving} activeOpacity={0.7}>
                  {saving ? <ActivityIndicator color={T.colors.bg} size="small" /> : <Ionicons name="checkmark" size={20} color={T.colors.bg} />}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        <View style={styles.topBarAccentLine} />
      </LinearGradient>

      {/* ── Scrollable Body ── */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── HERO HEADER ── */}
        <View style={styles.heroContainer}>
          <TouchableOpacity
            onPress={() => isEditing && setAvatarModalVisible(true)}
            disabled={!isEditing}
            activeOpacity={isEditing ? 0.7 : 1}
          >
            <View style={[styles.avatarRing, isActive && styles.avatarRingActive]}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={[T.colors.greenGrad1, T.colors.greenGrad2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarGradient}>
                  <Text style={styles.avatarInitial}>{deliveryMan.name?.charAt(0).toUpperCase() || 'D'}</Text>
                </LinearGradient>
              )}
              {isEditing && (
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={14} color={T.colors.bg} />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {!isEditing ? (
            <>
              <Text style={[styles.heroName, isRTL && { textAlign: 'center' }]}>{deliveryMan.name}</Text>
              <Text style={[styles.heroSub, isRTL && { textAlign: 'center' }]}>
                {deliveryMan.email}  ·  {pt.idLabel(deliveryMan.id)}
              </Text>
              <View style={[styles.statusChip, isActive ? styles.statusChipActive : styles.statusChipInactive]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? T.colors.accent : T.colors.danger }]} />
                <Text style={[styles.statusChipText, { color: isActive ? T.colors.accent : T.colors.danger }]}>
                  {isActive ? pt.active : pt.offline}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.heroName}>{pt.editTitle}</Text>
          )}
        </View>

        {/* ── PERSONAL INFO CARD ── */}
        <View style={[styles.card, T.shadow.card]}>
          <SectionHeader title={pt.sectionPersonal} icon="person-outline" isRTL={isRTL} />
          <InfoRow
            icon="person-outline" label={pt.labelFullName}
            value={isEditing ? formData.name : deliveryMan.name}
            editable={isEditing} placeholder={pt.placeholderName}
            onChangeText={text => setFormData({ ...formData, name: text })}
            isRTL={isRTL}
          />
          <InfoRow
            icon="mail-outline" label={pt.labelEmail}
            value={isEditing ? formData.email : deliveryMan.email}
            editable={isEditing} placeholder={pt.placeholderEmail}
            onChangeText={text => setFormData({ ...formData, email: text })}
            isRTL={isRTL}
          />
          <InfoRow
            icon="call-outline" label={pt.labelPhone}
            value={isEditing ? formData.phone : deliveryMan.phone}
            editable={isEditing} placeholder={pt.placeholderPhone}
            onChangeText={text => setFormData({ ...formData, phone: text })}
            isLast isRTL={isRTL}
          />
        </View>

        {/* ── VEHICLE CARD ── */}
        <View style={[styles.card, T.shadow.card]}>
          <SectionHeader title={pt.sectionVehicle} icon="car-outline" isRTL={isRTL} />
          <InfoRow
            icon="bicycle-outline" label={pt.labelVehicleType}
            value={isEditing ? formData.vehicle_type : deliveryMan.vehicle_type}
            editable={isEditing}
            onChangeText={text => setFormData({ ...formData, vehicle_type: text })}
            inputType="select" options={vehicleTypes}
            isRTL={isRTL}
          />
          <InfoRow
            icon="card-outline" label={pt.labelLicense}
            value={isEditing ? formData.license_number : deliveryMan.license_number}
            editable={isEditing} placeholder={pt.placeholderLicense}
            onChangeText={text => setFormData({ ...formData, license_number: text })}
            isLast isRTL={isRTL}
          />
        </View>

        {/* ── LANGUAGE CARD ── */}
        <View style={[styles.card, T.shadow.card]}>
          <SectionHeader title={pt.sectionLanguage} icon="language-outline" isRTL={isRTL} />
          <LanguageSelector language={language} setLanguage={setLanguage} pt={pt} isRTL={isRTL} />
        </View>

        {/* ── VERIFICATION CARD ── */}
        {!isEditing && (
          <View style={[styles.card, T.shadow.card]}>
            <SectionHeader title={pt.sectionVerification} icon="shield-checkmark-outline" isRTL={isRTL} />
            <View style={[styles.verificationRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.verificationLeft, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="document-text-outline" size={16} color={T.colors.gray2} />
                <Text style={styles.verificationLabel}>{pt.verDocuments}</Text>
              </View>
              <VerificationBadge status={documentStatus} verifiedLabel={pt.verVerified} pendingLabel={pt.verPending} missingLabel={pt.verMissing} />
            </View>
            <View style={[styles.verificationRow, styles.verificationRowLast, isRTL && { flexDirection: 'row-reverse' }]}>
              <View style={[styles.verificationLeft, isRTL && { flexDirection: 'row-reverse' }]}>
                <Ionicons name="person-outline" size={16} color={T.colors.gray2} />
                <Text style={styles.verificationLabel}>{pt.verIdentity}</Text>
              </View>
              <VerificationBadge status="verified" verifiedLabel={pt.verVerified} pendingLabel={pt.verPending} missingLabel={pt.verMissing} />
            </View>
          </View>
        )}

        {/* ── LOCATION CARD ── */}
        {!isEditing && deliveryMan.current_latitude && deliveryMan.current_longitude && (
          <View style={[styles.card, T.shadow.card]}>
            <SectionHeader title={pt.sectionLocation} icon="location-outline" isRTL={isRTL} />
            <View style={[styles.locationRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="navigate-outline" size={14} color={T.colors.accent} />
              <Text style={[styles.locationText, isRTL && { textAlign: 'right' }]}>
                {Number(deliveryMan.current_latitude).toFixed(6)}, {Number(deliveryMan.current_longitude).toFixed(6)}
              </Text>
            </View>
            <View style={[styles.locationRow, isRTL && { flexDirection: 'row-reverse' }]}>
              <Ionicons name="time-outline" size={14} color={T.colors.gray3} />
              <Text style={[styles.locationText, { color: T.colors.gray3 }, isRTL && { textAlign: 'right' }]}>
                {deliveryMan.last_location_update
                  ? pt.locUpdated(new Date(deliveryMan.last_location_update).toLocaleTimeString())
                  : pt.locNever}
              </Text>
            </View>
          </View>
        )}

        {/* ── ACTIONS ── */}
        {!isEditing && (
          <View style={styles.actionsSection}>
            {/* <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert(ct.comingSoon, pt.alertDocumentsMsg)} activeOpacity={0.75}>
              <View style={styles.actionBtnIcon}>
                <Ionicons name="document-text-outline" size={18} color={T.colors.accent} />
              </View>
              <Text style={[styles.actionBtnText, isRTL && { textAlign: 'right' }]}>{pt.viewDocuments}</Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={T.colors.gray3} />
            </TouchableOpacity> */}

            {/* <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert(ct.comingSoon, pt.alertPasswordMsg)} activeOpacity={0.75}>
              <View style={styles.actionBtnIcon}>
                <Ionicons name="lock-closed-outline" size={18} color={T.colors.accent} />
              </View>
              <Text style={[styles.actionBtnText, isRTL && { textAlign: 'right' }]}>{pt.changePassword}</Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={T.colors.gray3} />
            </TouchableOpacity> */}

            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleLogout} activeOpacity={0.75}>
              <View style={[styles.actionBtnIcon, styles.actionBtnIconDanger]}>
                <Ionicons name="log-out-outline" size={18} color={T.colors.danger} />
              </View>
              <Text style={[styles.actionBtnText, { color: T.colors.danger }, isRTL && { textAlign: 'right' }]}>{pt.logout}</Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={T.colors.danger + '66'} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Avatar Modal ── */}
      <Modal visible={avatarModalVisible} transparent animationType="slide" onRequestClose={() => setAvatarModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && { textAlign: 'right' }]}>{pt.avatarModalTitle}</Text>

            <TouchableOpacity style={styles.modalOption} onPress={() => pickImage('camera')} activeOpacity={0.75}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="camera-outline" size={20} color={T.colors.accent} />
              </View>
              <Text style={[styles.modalOptionText, isRTL && { textAlign: 'right' }]}>{pt.takePhoto}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={() => pickImage('library')} activeOpacity={0.75}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="images-outline" size={20} color={T.colors.accent} />
              </View>
              <Text style={[styles.modalOptionText, isRTL && { textAlign: 'right' }]}>{pt.chooseLibrary}</Text>
            </TouchableOpacity>

            {image && (
              <TouchableOpacity style={[styles.modalOption, styles.modalOptionDanger]} onPress={removeImage} activeOpacity={0.75}>
                <View style={[styles.modalOptionIcon, { backgroundColor: T.colors.dangerDim }]}>
                  <Ionicons name="trash-outline" size={20} color={T.colors.danger} />
                </View>
                <Text style={[styles.modalOptionText, { color: T.colors.danger }, isRTL && { textAlign: 'right' }]}>{pt.removePhoto}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalCancel} onPress={() => setAvatarModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>{ct.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ===================== Styles (all unchanged) =====================
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: T.colors.bg },
  centered:    { justifyContent: 'center', alignItems: 'center' },
  errorText:   { marginTop: T.spacing.md, ...T.typography.body, color: T.colors.gray2 },

  topBar: { paddingHorizontal: T.spacing.lg, paddingBottom: T.spacing.lg, paddingTop: T.spacing.sm, overflow: 'hidden' },
  topBarInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarEyebrow: { ...T.typography.label, color: T.colors.accent, marginBottom: 2 },
  topBarTitle:   { ...T.typography.title, color: T.colors.white },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: T.spacing.sm },
  topBarAccentLine: { height: 2, backgroundColor: T.colors.accent, marginTop: T.spacing.md, borderRadius: 1, opacity: 0.6 },
  iconBtn: { width: 40, height: 40, borderRadius: T.radius.md, backgroundColor: T.colors.bgCardAlt, borderWidth: 1, borderColor: T.colors.separator, justifyContent: 'center', alignItems: 'center' },
  iconBtnAccent: { backgroundColor: T.colors.accent, borderColor: T.colors.accent },
  skeletonIcon:  { width: 40, height: 40, borderRadius: T.radius.md, backgroundColor: T.colors.bgCardAlt },

  scrollView: { flex: 1 },
  scrollContent: { padding: T.spacing.lg, paddingBottom: T.spacing.xxl },

  heroContainer: { alignItems: 'center', paddingVertical: T.spacing.xl, marginBottom: T.spacing.md },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: T.colors.gray4, overflow: 'hidden', marginBottom: T.spacing.lg, ...T.shadow.card },
  avatarRingActive: { borderColor: T.colors.accent, ...T.shadow.glow },
  avatarImage: { width: '100%', height: '100%' },
  avatarGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  avatarInitial:  { fontSize: 42, fontWeight: '800', color: T.colors.bg },
  avatarEditBadge:{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: T.colors.accent, justifyContent: 'center', alignItems: 'center' },
  heroName: { ...T.typography.heroName, color: T.colors.white, marginBottom: T.spacing.xs, textAlign: 'center' },
  heroSub:  { ...T.typography.caption, color: T.colors.gray2, marginBottom: T.spacing.md, textAlign: 'center' },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.spacing.lg, paddingVertical: T.spacing.sm, borderRadius: T.radius.round, borderWidth: 1, gap: 6 },
  statusChipActive:   { backgroundColor: T.colors.accentDim, borderColor: T.colors.accentBorder },
  statusChipInactive: { backgroundColor: T.colors.dangerDim, borderColor: T.colors.danger + '44' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { ...T.typography.label, letterSpacing: 1.5 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: T.spacing.lg, gap: T.spacing.sm },
  statCard: { flex: 1, backgroundColor: T.colors.bgCard, borderRadius: T.radius.md, paddingVertical: T.spacing.md, paddingHorizontal: T.spacing.sm, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: T.colors.separator },
  statAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderTopLeftRadius: T.radius.md, borderTopRightRadius: T.radius.md },
  statIconWrap: { width: 34, height: 34, borderRadius: T.radius.sm, justifyContent: 'center', alignItems: 'center', marginTop: T.spacing.xs, marginBottom: T.spacing.sm },
  statValue: { ...T.typography.statValue, color: T.colors.white, marginBottom: 2 },
  statLabel: { ...T.typography.statLabel, color: T.colors.gray2, textAlign: 'center' },

  card: { backgroundColor: T.colors.bgCard, borderRadius: T.radius.lg, marginBottom: T.spacing.md, borderWidth: 1, borderColor: T.colors.separator, overflow: 'hidden' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.spacing.lg, paddingTop: T.spacing.lg, paddingBottom: T.spacing.md, gap: T.spacing.sm, borderBottomWidth: 1, borderBottomColor: T.colors.separator },
  sectionIconWrap:  { width: 22, height: 22, borderRadius: 6, backgroundColor: T.colors.accentDim, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { ...T.typography.sectionTitle, color: T.colors.gray2 },

  infoRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.spacing.lg, paddingVertical: T.spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: T.colors.separator },
  infoRowLast:   {},
  infoIconWrap:  { width: 32, height: 32, borderRadius: T.radius.sm, backgroundColor: T.colors.bgCardAlt, justifyContent: 'center', alignItems: 'center', marginRight: T.spacing.md },
  infoContent:   { flex: 1 },
  infoLabel:     { ...T.typography.label, color: T.colors.gray3, marginBottom: 3 },
  infoValue:     { ...T.typography.value, color: T.colors.gray1 },
  infoInput:     { ...T.typography.value, color: T.colors.white, borderBottomWidth: 1, borderBottomColor: T.colors.accentBorder, paddingVertical: 4 },

  selectContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: T.spacing.sm, marginTop: T.spacing.sm },
  selectOption:    { paddingHorizontal: T.spacing.md, paddingVertical: T.spacing.sm, borderRadius: T.radius.round, backgroundColor: T.colors.bgCardAlt, borderWidth: 1, borderColor: T.colors.separator },
  selectOptionActive:    { backgroundColor: T.colors.accentDim, borderColor: T.colors.accentBorder },
  selectOptionText:      { ...T.typography.caption, color: T.colors.gray2 },
  selectOptionTextActive:{ color: T.colors.accent, fontWeight: '700' },

  verificationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: T.spacing.lg, paddingVertical: T.spacing.md, borderBottomWidth: 1, borderBottomColor: T.colors.separator },
  verificationRowLast: { borderBottomWidth: 0 },
  verificationLeft: { flexDirection: 'row', alignItems: 'center', gap: T.spacing.sm },
  verificationLabel: { ...T.typography.value, color: T.colors.gray1 },
  verificationBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.spacing.sm + 2, paddingVertical: T.spacing.xs, borderRadius: T.radius.round, borderWidth: 1, gap: 4 },
  verificationText:  { ...T.typography.caption, fontWeight: '700' },

  locationRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: T.spacing.lg, paddingVertical: T.spacing.sm, gap: T.spacing.sm },
  locationText: { ...T.typography.caption, color: T.colors.gray2 },

  actionsSection: { marginTop: T.spacing.sm, gap: T.spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.colors.bgCard, borderRadius: T.radius.md, paddingHorizontal: T.spacing.lg, paddingVertical: T.spacing.md, borderWidth: 1, borderColor: T.colors.separator, ...T.shadow.card, gap: T.spacing.md },
  actionBtnDanger: { borderColor: T.colors.danger + '33', backgroundColor: T.colors.dangerDim },
  actionBtnIcon: { width: 36, height: 36, borderRadius: T.radius.sm, backgroundColor: T.colors.accentDim, justifyContent: 'center', alignItems: 'center' },
  actionBtnIconDanger: { backgroundColor: T.colors.dangerDim },
  actionBtnText: { flex: 1, ...T.typography.value, color: T.colors.gray1, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: T.colors.bgCard, borderTopLeftRadius: T.radius.xl, borderTopRightRadius: T.radius.xl, padding: T.spacing.xl, paddingBottom: T.spacing.xxl + T.spacing.xl, borderTopWidth: 1, borderTopColor: T.colors.separator },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.colors.gray3, alignSelf: 'center', marginBottom: T.spacing.xl },
  modalTitle:  { ...T.typography.title, color: T.colors.white, marginBottom: T.spacing.xl, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.colors.bgCardAlt, borderRadius: T.radius.md, padding: T.spacing.lg, marginBottom: T.spacing.sm, borderWidth: 1, borderColor: T.colors.separator, gap: T.spacing.md },
  modalOptionDanger: { backgroundColor: T.colors.dangerDim, borderColor: T.colors.danger + '33' },
  modalOptionIcon: { width: 36, height: 36, borderRadius: T.radius.sm, backgroundColor: T.colors.accentDim, justifyContent: 'center', alignItems: 'center' },
  modalOptionText: { ...T.typography.value, color: T.colors.gray1, fontWeight: '600' },
  modalCancel: { marginTop: T.spacing.md, padding: T.spacing.lg, alignItems: 'center' },
  modalCancelText: { ...T.typography.value, color: T.colors.gray3, fontWeight: '600' },
});

export default ProfileScreen;