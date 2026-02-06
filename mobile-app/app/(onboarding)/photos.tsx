import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PhotoGrid } from '../../components/PhotoGrid';
import { useRegistration } from '../../context/RegistrationContext';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

export default function PhotosScreen() {
    const router = useRouter();
    const { data, updateData } = useRegistration();
    const { refreshProfile, token } = useAuth();

    // Initialize with nulls if empty or match existing
    const [photos, setPhotos] = useState<(string | null)[]>(
        data.photos && data.photos.length === 6 ? data.photos : [null, null, null, null, null, null]
    );

    const nonNullCount = photos.filter(p => p !== null).length;
    const [isSubmitting, setIsSubmitting] = useState(false);

    // DEV HELPER: For Emulator testing
    const loadSamplePhotos = () => {
        setPhotos([
            'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=1887&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=2459&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1887&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1887&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1887&auto=format&fit=crop',
            null
        ]);
    };

    const handleAddPhoto = async (index: number) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permission Denied", "We need access to your photos to upload them.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0].uri) {
            const newPhotos = [...photos];
            newPhotos[index] = result.assets[0].uri;
            setPhotos(newPhotos);
        }
    };

    const handleRemovePhoto = (index: number) => {
        const newPhotos = [...photos];
        newPhotos[index] = null;
        setPhotos(newPhotos);
    };

    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Robust Platform Check for URL
    const API_URL = Platform.OS === 'android'
        ? 'http://10.0.2.2:8000/api/users/me'
        : 'http://localhost:8000/api/users/me';

    const handleNext = async () => {
        if (nonNullCount < 4) {
            const msg = "Please add at least 4 photos to continue.";
            if (Platform.OS === 'web') {
                setErrorMsg(msg);
            } else {
                Alert.alert("More Photos Required", msg);
            }
            return;
        }

        setErrorMsg(null);
        setIsSubmitting(true);
        const finalPhotos = photos; // In a real app, this would involve uploading files

        try {
            console.log("[PhotosScreen] Submitting to", API_URL);

            const body = {
                // Identity
                phoneNumber: data.phoneNumber,
                firstName: data.firstName,
                birthday: data.birthday.toISOString(),
                gender: data.gender,
                showGender: data.showGender,
                datingPreference: data.datingPreference,
                mode: data.mode,
                intention: data.intention,
                height: data.height,
                exercise: data.exercise,
                education: data.education,
                drinking: data.drinking,
                smoking: data.smoking,
                kids: data.kids,
                interests: data.interests,
                values: data.values,
                causes: data.causes,
                religion: data.religion,
                politics: data.politics,
                prompts: data.prompts,
                bio: data.bio,
                photos: finalPhotos,
            };

            const response = await fetch(API_URL, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                console.log("[PhotosScreen] Success");
                await refreshProfile();
                // Explicitly navigate to Home as this is the final step
                router.replace('/(tabs)/discovery');
            } else {
                const err = await response.text();
                console.warn("[PhotosScreen] Error:", err);
                Alert.alert("Error", "Failed to save profile. Please try again.");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Network Error", "Could not connect to server.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>Add your photos</Text>
            <Text style={styles.subtitle}>Add at least 4 photos to continue.</Text>

            <View style={{ height: 20 }} />

            <PhotoGrid
                photos={photos}
                onPhotosChange={setPhotos}
                onAddPhoto={handleAddPhoto}
                onRemovePhoto={handleRemovePhoto}
            />

            {errorMsg && <Text style={{ color: COLORS.destructive, marginTop: 10, textAlign: 'center' }}>{errorMsg}</Text>}

            {/* DEV TOOL: Sample Photos */}
            {(__DEV__ && nonNullCount < 4) && (
                <TouchableOpacity
                    onPress={loadSamplePhotos}
                    style={{ marginTop: 20, alignSelf: 'center', padding: 10 }}
                >
                    <Text style={{ color: COLORS.primary, textDecorationLine: 'underline' }}>
                        [DEV] Fill Sample Photos
                    </Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={[styles.nextButton, { opacity: (nonNullCount >= 4 && !isSubmitting) ? 1 : 0.5 }]}
                onPress={handleNext}
                disabled={nonNullCount < 4 || isSubmitting}
            >
                {isSubmitting ? (
                    <ActivityIndicator color={COLORS.brandBase} />
                ) : (
                    <Ionicons name="arrow-forward" size={24} color={COLORS.brandBase} />
                )}
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screen
    },
    backButton: {
        marginBottom: SPACING.section
    },
    title: {
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        marginBottom: SPACING.sm
    },
    subtitle: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        marginBottom: SPACING.section
    },
    nextButton: {
        position: 'absolute', bottom: 40, right: 24,
        width: 56, height: 56,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.small
    }
});
