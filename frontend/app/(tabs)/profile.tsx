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
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import Colors from '@/constants/Colors';
import { ProfileHeaderSkeleton, Skeleton } from '@/components/ui/skeleton';

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

// ===================== UI Components =====================
const StatCard = ({ icon, value, label, color }: { icon: string; value: string | number; label: string; color?: string }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, color && { backgroundColor: color + '20' }]}>
      <Ionicons name={icon as any} size={24} color={color || Colors.primary} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const SectionCard = ({ children, title, icon }: { children: React.ReactNode; title: string; icon?: string }) => (
  <View style={styles.sectionCard}>
    {title && (
      <View style={styles.sectionHeader}>
        {icon && <Ionicons name={icon as any} size={20} color={Colors.primary} style={styles.sectionIcon} />}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    )}
    <View style={styles.sectionContent}>{children}</View>
  </View>
);

const InfoRow = ({
  icon,
  label,
  value,
  editable = false,
  onChangeText,
  inputType = 'text',
  options,
  isLast = false,
}: {
  icon: string;
  label: string;
  value: string | number | null;
  editable?: boolean;
  onChangeText?: (text: string) => void;
  inputType?: 'text' | 'select';
  options?: string[];
  isLast?: boolean;
}) => {
  if (editable && inputType === 'select' && options) {
    return (
      <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
        <View style={styles.infoIconContainer}>
          <Ionicons name={icon as any} size={20} color={Colors.primary} />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>{label}</Text>
          <View style={styles.selectContainer}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.selectOption,
                  value === option && styles.selectOptionActive,
                ]}
                onPress={() => onChangeText?.(option)}
              >
                <Text
                  style={[
                    styles.selectOptionText,
                    value === option && styles.selectOptionTextActive,
                  ]}
                >
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
      <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
        <View style={styles.infoIconContainer}>
          <Ionicons name={icon as any} size={20} color={Colors.primary} />
        </View>
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>{label}</Text>
          <TextInput
            style={styles.input}
            value={value?.toString() || ''}
            onChangeText={onChangeText}
            placeholder={`Enter ${label.toLowerCase()}`}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <View style={styles.infoIconContainer}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>
          {value || 'Not available'}
        </Text>
      </View>
    </View>
  );
};

const VerificationBadge = ({ status }: { status: 'verified' | 'pending' | 'missing' }) => {
  const config = {
    verified: { icon: 'checkmark-circle', color: '#10B981', text: 'Verified' },
    pending: { icon: 'time', color: Colors.orange, text: 'Pending' },
    missing: { icon: 'alert-circle', color: '#EF4444', text: 'Missing' },
  };
  const { icon, color, text } = config[status];

  return (
    <View style={[styles.verificationBadge, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon as any} size={14} color={color} />
      <Text style={[styles.verificationText, { color }]}>{text}</Text>
    </View>
  );
};

// ===================== Main Screen =====================
const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [deliveryMan, setDeliveryMan] = useState<DeliveryMan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle_type: 'Motorcycle',
    license_number: '',
  });
  const [image, setImage] = useState<string | null>(null);

  const vehicleTypes = ['Bicycle', 'Motorcycle', 'Car', 'Van'];

  const fetchProfile = useCallback(async () => {
    try {
      console.log('🔄 Starting profile fetch...');
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        console.log('❌ No token found, redirecting to login');
        router.replace('/login');
        return;
      }

      console.log('✅ Token found, fetching profile...');
      try {
        const response = await fetch('https://ubua.cloud/api/delivery/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        console.log('📦 Profile response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Profile data received:', data);
          setDeliveryMan(data.deliveryMan);
          setFormData({
            name: data.deliveryMan.name || '',
            email: data.deliveryMan.email || '',
            phone: data.deliveryMan.phone || '',
            vehicle_type: data.deliveryMan.vehicle_type || 'Motorcycle',
            license_number: data.deliveryMan.license_number || '',
          });
          setImage(data.deliveryMan.image || null);
          await AsyncStorage.setItem('deliveryMan', JSON.stringify(data.deliveryMan));
          console.log('✅ Profile loaded successfully');
        } else if (response.status === 401) {
          console.log('❌ 401 Unauthorized, redirecting to login');
          router.replace('/login');
          return;
        } else {
          console.log('⚠️ Profile fetch failed, using cached data');
          const cachedData = await AsyncStorage.getItem('deliveryMan');
          if (cachedData) {
            const parsed = JSON.parse(cachedData);
            console.log('📱 Using cached profile data');
            setDeliveryMan(parsed);
            setFormData({
              name: parsed.name || '',
              email: parsed.email || '',
              phone: parsed.phone || '',
              vehicle_type: parsed.vehicle_type || 'Motorcycle',
              license_number: parsed.license_number || '',
            });
            setImage(parsed.image || null);
          }
        }
      } catch (fetchError) {
        console.error('❌ Error fetching profile from API:', fetchError);
        const cachedData = await AsyncStorage.getItem('deliveryMan');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          console.log('📱 Using cached profile data after fetch error');
          setDeliveryMan(parsed);
          setFormData({
            name: parsed.name || '',
            email: parsed.email || '',
            phone: parsed.phone || '',
            vehicle_type: parsed.vehicle_type || 'Motorcycle',
            license_number: parsed.license_number || '',
          });
          setImage(parsed.image || null);
        }
      }
    } catch (error) {
      console.error('❌ Error in fetchProfile:', error);
    } finally {
      console.log('🏁 Profile fetch completed, setting loading to false');
      setLoading(false);
    }
  }, [router]);

  // Update delivery man location periodically
  const updateLocation = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await fetch('https://ubua.cloud/api/delivery/update-location', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
      });
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    // Update location every 15 seconds when profile screen is active
    const locationInterval = setInterval(() => {
      updateLocation();
    }, 15000); // Update every 15 seconds

    // Initial location update
    updateLocation();

    return () => {
      clearInterval(locationInterval);
    };
  }, [fetchProfile, updateLocation]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await AsyncStorage.removeItem('deliveryManToken');
              await AsyncStorage.removeItem('deliveryMan');
              router.replace('/login');
            } catch (error) {
              console.error('Error during logout:', error);
            }
          },
        },
      ]
    );
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to take a photo.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library permission is required.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
        setAvatarModalVisible(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeImage = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setImage(null);
            setAvatarModalVisible(false);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('deliveryManToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const formDataToSend = new FormData();

      // Add text fields
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('phone', formData.phone);
      formDataToSend.append('vehicle_type', formData.vehicle_type);
      formDataToSend.append('license_number', formData.license_number);

      // Handle image
      if (image) {
        if (image.startsWith('http') || image.startsWith('file://')) {
          // It's a local file or existing URL
          if (image.startsWith('file://') || !image.startsWith('http')) {
            // It's a new local file, upload it
            const filename = image.split('/').pop() || 'photo.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : 'image/jpeg';

            formDataToSend.append('image', {
              uri: image,
              name: filename,
              type,
            } as any);
          } else {
            // It's an existing server URL, don't change it
            formDataToSend.append('image', '');
          }
        } else {
          // It's a filename from server, keep it
          formDataToSend.append('image', '');
        }
      } else {
        // User wants to remove image
        formDataToSend.append('image', '');
      }

      const response = await fetch('https://ubua.cloud/api/delivery/update-profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        const data = await response.json();
        setDeliveryMan(data.deliveryMan);
        setImage(data.deliveryMan.image || null);
        await AsyncStorage.setItem('deliveryMan', JSON.stringify(data.deliveryMan));
        setIsEditing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Profile updated successfully!');
        fetchProfile();
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const renderSkeleton = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <Skeleton width={120} height={120} borderRadius={60} />
        <Skeleton width={180} height={24} borderRadius={4} style={{ marginTop: 16 }} />
        <Skeleton width={140} height={16} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.statsGrid}>
        <Skeleton width="31%" height={90} borderRadius={16} />
        <Skeleton width="31%" height={90} borderRadius={16} />
        <Skeleton width="31%" height={90} borderRadius={16} />
      </View>
      <Skeleton width="100%" height={200} borderRadius={20} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={160} borderRadius={20} style={{ marginBottom: 16 }} />
    </ScrollView>
  );

  if (loading && !deliveryMan) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[Colors.dark, Colors.darkLight]}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.headerActions}>
              <View style={styles.skeletonHeaderIcon} />
            </View>
          </View>
        </LinearGradient>
        {renderSkeleton()}
      </View>
    );
  }

  if (!deliveryMan) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Failed to load profile</Text>
        </View>
      </View>
    );
  }

  const displayImage = image
    ? image.startsWith('http') || image.startsWith('file://')
      ? image
      : `https://ubua.cloud/uploads/deliveryManImages/${image.replace(/\\/g, '/')}`
    : null;

  // Mock data for demonstration - replace with actual data when available
  const todayEarnings = "$124.50";
  const totalDeliveries = "48";
  const rating = "4.8";

  // Document status (mock - replace with actual logic)
  const documentStatus: 'verified' | 'pending' | 'missing' = 'verified';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[Colors.dark, Colors.darkLight]}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerActions}>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerButton}>
                <Ionicons name="create-outline" size={22} color="#fff" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditing(false);
                    fetchProfile();
                  }}
                  style={styles.headerButton}
                >
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={[styles.headerButton, styles.headerButtonPrimary]}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="checkmark" size={22} color="#fff" />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Identity Section */}
        <View style={styles.identitySection}>
          <TouchableOpacity
            onPress={() => isEditing && setAvatarModalVisible(true)}
            disabled={!isEditing}
            activeOpacity={isEditing ? 0.7 : 1}
          >
            <View style={styles.avatarLargeContainer}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatarLargeImage} />
              ) : (
                <LinearGradient
                  colors={[Colors.primary, Colors.orange]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarLargeGradient}
                >
                  <Text style={styles.avatarInitials}>
                    {deliveryMan.name?.charAt(0).toUpperCase() || 'D'}
                  </Text>
                </LinearGradient>
              )}
              {isEditing && (
                <View style={styles.editAvatarLargeBadge}>
                  <Ionicons name="camera" size={18} color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {!isEditing ? (
            <>
              <Text style={styles.identityName}>{deliveryMan.name}</Text>
              <Text style={styles.identitySubtitle}>
                {deliveryMan.email} • ID: {deliveryMan.id}
              </Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: deliveryMan.is_active ? '#10B981' : '#EF4444' },
                  ]}
                />
                <Text style={styles.statusText}>
                  {deliveryMan.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.identityName}>Edit Profile</Text>
          )}
        </View>

        {/* Performance Snapshot */}
        {!isEditing && (
          <View style={styles.statsGrid}>
            <StatCard icon="cash-outline" value={todayEarnings} label="Today's Earnings" color="#10B981" />
            <StatCard icon="cube-outline" value={totalDeliveries} label="Deliveries" color={Colors.primary} />
            <StatCard icon="star-outline" value={rating} label="Rating" color="#F59E0B" />
          </View>
        )}

        {/* Personal Information */}
        <SectionCard title="Personal Information" icon="person-outline">
          <InfoRow
            icon="person-outline"
            label="Full Name"
            value={isEditing ? formData.name : deliveryMan.name}
            editable={isEditing}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
          />
          <InfoRow
            icon="mail-outline"
            label="Email Address"
            value={isEditing ? formData.email : deliveryMan.email}
            editable={isEditing}
            onChangeText={(text) => setFormData({ ...formData, email: text })}
          />
          <InfoRow
            icon="call-outline"
            label="Phone Number"
            value={isEditing ? formData.phone : deliveryMan.phone}
            editable={isEditing}
            onChangeText={(text) => setFormData({ ...formData, phone: text })}
            isLast
          />
        </SectionCard>

        {/* Vehicle Information */}
        <SectionCard title="Vehicle Information" icon="car-outline">
          <InfoRow
            icon="bicycle-outline"
            label="Vehicle Type"
            value={isEditing ? formData.vehicle_type : deliveryMan.vehicle_type}
            editable={isEditing}
            onChangeText={(text) => setFormData({ ...formData, vehicle_type: text })}
            inputType="select"
            options={vehicleTypes}
          />
          <InfoRow
            icon="card-outline"
            label="License / Plate"
            value={isEditing ? formData.license_number : deliveryMan.license_number}
            editable={isEditing}
            onChangeText={(text) => setFormData({ ...formData, license_number: text })}
            isLast
          />
        </SectionCard>

        {/* Verification Status */}
        {!isEditing && (
          <SectionCard title="Verification" icon="shield-checkmark-outline">
            <View style={styles.verificationRow}>
              <View style={styles.verificationLeft}>
                <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
                <Text style={styles.verificationLabel}>Documents</Text>
              </View>
              <VerificationBadge status={documentStatus} />
            </View>
            <View style={[styles.verificationRow, styles.verificationRowLast]}>
              <View style={styles.verificationLeft}>
                <Ionicons name="person-outline" size={20} color={Colors.primary} />
                <Text style={styles.verificationLabel}>Identity</Text>
              </View>
              <VerificationBadge status="verified" />
            </View>
          </SectionCard>
        )}

        {/* Location Information (Collapsed for cleaner UI) */}
        {!isEditing && deliveryMan.current_latitude && deliveryMan.current_longitude && (
          <SectionCard title="Current Location" icon="location-outline">
            <View style={styles.locationRow}>
              <Ionicons name="navigate-outline" size={16} color={Colors.text.secondary} />
              <Text style={styles.locationText}>
                {Number(deliveryMan.current_latitude).toFixed(6)}, {Number(deliveryMan.current_longitude).toFixed(6)}
              </Text>
            </View>
            <View style={styles.locationRow}>
              <Ionicons name="time-outline" size={16} color={Colors.text.secondary} />
              <Text style={styles.locationText}>
                Updated {deliveryMan.last_location_update
                  ? new Date(deliveryMan.last_location_update).toLocaleTimeString()
                  : 'Never'}
              </Text>
            </View>
          </SectionCard>
        )}

        {/* Action Buttons */}
        {!isEditing && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Coming Soon', 'Documents view')}>
              <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
              <Text style={styles.actionButtonText}>View Documents</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => Alert.alert('Coming Soon', 'Change password')}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
              <Text style={styles.actionButtonText}>Change Password</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={[styles.actionButtonText, styles.logoutButtonText]}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Avatar Selection Modal */}
      <Modal
        visible={avatarModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Profile Photo</Text>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickImage('camera')}
            >
              <Ionicons name="camera-outline" size={24} color={Colors.primary} />
              <Text style={styles.modalOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => pickImage('library')}
            >
              <Ionicons name="images-outline" size={24} color={Colors.primary} />
              <Text style={styles.modalOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            {image && (
              <TouchableOpacity
                style={[styles.modalOption, styles.modalOptionDanger]}
                onPress={removeImage}
              >
                <Ionicons name="trash-outline" size={24} color="#EF4444" />
                <Text style={[styles.modalOptionText, { color: '#EF4444' }]}>
                  Remove Photo
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setAvatarModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonPrimary: {
    backgroundColor: Colors.primary,
  },
  skeletonHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  identitySection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarLargeContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarLargeImage: {
    width: '100%',
    height: '100%',
  },
  avatarLargeGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  editAvatarLargeBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  identityName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  identitySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  selectOptionTextActive: {
    color: '#fff',
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  verificationRowLast: {
    borderBottomWidth: 0,
  },
  verificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#4B5563',
  },
  actionsContainer: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 12,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutButtonText: {
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  modalOptionDanger: {
    backgroundColor: '#FEF2F2',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 12,
  },
  modalCancel: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});

export default ProfileScreen;