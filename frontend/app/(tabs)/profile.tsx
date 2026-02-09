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

  const InfoRow = ({
    icon,
    label,
    value,
    editable = false,
    onChangeText,
    inputType = 'text',
    options,
  }: {
    icon: string;
    label: string;
    value: string | number | null;
    editable?: boolean;
    onChangeText?: (text: string) => void;
    inputType?: 'text' | 'select';
    options?: string[];
  }) => {
    if (editable && isEditing) {
      if (inputType === 'select' && options) {
        return (
          <View style={styles.infoRow}>
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
                      formData.vehicle_type === option && styles.selectOptionActive,
                    ]}
                    onPress={() => onChangeText?.(option)}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        formData.vehicle_type === option && styles.selectOptionTextActive,
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
      return (
        <View style={styles.infoRow}>
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
              placeholderTextColor={Colors.text.secondary}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.infoRow}>
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

  const renderSkeleton = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileHeader}>
        <Skeleton width={100} height={100} borderRadius={50} />
        <Skeleton width={150} height={20} borderRadius={4} style={{ marginTop: 16 }} />
        <Skeleton width={200} height={14} borderRadius={4} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.section}>
        <Skeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={60} borderRadius={12} style={{ marginBottom: 12 }} />
        <Skeleton width="100%" height={60} borderRadius={12} />
      </View>
    </ScrollView>
  );

  if (loading && !deliveryMan) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[Colors.dark, Colors.darkLight]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
            <Ionicons name="person" size={32} color="#fff" />
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[Colors.dark, Colors.darkLight]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Delivery Partner</Text>
          </View>
          <View style={styles.headerActions}>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                <Ionicons name="create-outline" size={24} color="#fff" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setIsEditing(false);
                    fetchProfile();
                  }}
                  style={styles.cancelButton}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.saveButton}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="checkmark" size={24} color="#fff" />
                  )}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity
            onPress={() => isEditing && setAvatarModalVisible(true)}
            disabled={!isEditing}
            activeOpacity={isEditing ? 0.7 : 1}
          >
            <View style={styles.avatarContainer}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.avatarImage} />
              ) : (
                <LinearGradient
                  colors={[Colors.dark, Colors.darkLight]}
                  style={styles.avatarGradient}
                >
                  <Ionicons name="person" size={48} color="#fff" />
                </LinearGradient>
              )}
              {isEditing && (
                <View style={styles.editAvatarBadge}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          {!isEditing ? (
            <>
              <Text style={styles.profileName}>{deliveryMan.name}</Text>
              <View style={styles.statusBadge}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: deliveryMan.is_active ? Colors.success : Colors.error },
                  ]}
                />
                <Text style={styles.statusText}>
                  {deliveryMan.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.profileName}>Edit Profile</Text>
          )}
        </View>

        {/* Profile Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon="person-outline"
              label="Name"
              value={isEditing ? formData.name : deliveryMan.name}
              editable={isEditing}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <InfoRow
              icon="mail-outline"
              label="Email"
              value={isEditing ? formData.email : deliveryMan.email}
              editable={isEditing}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
            />
            <InfoRow
              icon="call-outline"
              label="Phone"
              value={isEditing ? formData.phone : deliveryMan.phone}
              editable={isEditing}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
            />
          </View>
        </View>

        {/* Vehicle Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.infoCard}>
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
              label="License Number"
              value={isEditing ? formData.license_number : deliveryMan.license_number}
              editable={isEditing}
              onChangeText={(text) => setFormData({ ...formData, license_number: text })}
            />
          </View>
        </View>

        {/* Location Information */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.infoCard}>
              <InfoRow
                icon="location-outline"
                label="Last Update"
                value={
                  deliveryMan.last_location_update
                    ? new Date(deliveryMan.last_location_update).toLocaleString()
                    : 'Never'
                }
              />
              {deliveryMan.current_latitude && deliveryMan.current_longitude ? (
                <>
                  <InfoRow
                    icon="navigate-outline"
                    label="Latitude"
                    value={(Number(deliveryMan.current_latitude) || 0).toFixed(6)}
                  />
                  <InfoRow
                    icon="navigate-outline"
                    label="Longitude"
                    value={(Number(deliveryMan.current_longitude) || 0).toFixed(6)}
                  />
                </>
              ) : (
                <Text style={styles.noLocationText}>Location not available</Text>
              )}
            </View>
          </View>
        )}

        {/* Account Information */}
        {!isEditing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.infoCard}>
              <InfoRow
                icon="calendar-outline"
                label="Member Since"
                value={new Date(deliveryMan.created_at).toLocaleDateString()}
              />
            </View>
          </View>
        )}

        {/* Logout Button */}
        {!isEditing && (
          <TouchableOpacity
            style={styles.logoutButtonCard}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
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
                <Ionicons name="trash-outline" size={24} color={Colors.error} />
                <Text style={[styles.modalOptionText, { color: Colors.error }]}>
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  editButton: {
    padding: 8,
  },
  cancelButton: {
    padding: 8,
  },
  saveButton: {
    padding: 8,
  },
  logoutButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  input: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 4,
  },
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
    color: Colors.text.primary,
  },
  selectOptionTextActive: {
    color: '#fff',
  },
  noLocationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginLeft: 52,
  },
  logoutButtonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.error,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.error,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  modalOptionDanger: {
    backgroundColor: '#FEF2F2',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
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
    color: Colors.text.secondary,
  },
});

export default ProfileScreen;
