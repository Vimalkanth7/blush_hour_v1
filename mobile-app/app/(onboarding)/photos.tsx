import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PhotoGrid } from '../../components/PhotoGrid';
import { useRegistration } from '../../context/RegistrationContext';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL, isApiRequestError, photoUploadUrl, type ApiRequestError } from '../../constants/Api';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const guessMimeTypeFromUri = (uri: string): string | null => {
    const normalized = uri.toLowerCase().split('?')[0];
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (normalized.endsWith('.png')) {
        return 'image/png';
    }
    if (normalized.endsWith('.webp')) {
        return 'image/webp';
    }
    return null;
};

const parseResponseDetail = async (response: Response, fallbackMessage: string): Promise<string> => {
    const text = await response.text();
    if (!text) {
        return fallbackMessage;
    }

    try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.detail === 'string' && parsed.detail.trim()) {
            return parsed.detail;
        }
        if (typeof parsed?.message === 'string' && parsed.message.trim()) {
            return parsed.message;
        }
    } catch {
        // ignore parse errors and return plain text
    }

    return text.length > 300 ? fallbackMessage : text;
};

const createApiRequestError = (status: number, detail: string): ApiRequestError => {
    const error = new Error(detail) as ApiRequestError;
    error.name = 'ApiRequestError';
    error.status = status;
    error.detail = detail;
    return error;
};

const photoUploadErrorMessage = (error: unknown): string => {
    if (!isApiRequestError(error)) {
        return 'Could not upload photos right now. Please try again.';
    }

    const detail = error.detail.toLowerCase();
    if (error.status === 503) {
        return 'Photo uploads are unavailable right now. Please try again shortly.';
    }
    if (error.status === 413) {
        return 'Max 5MB per photo.';
    }
    if (error.status === 400 && (detail.includes('content_type') || detail.includes('content type') || detail.includes('unsupported'))) {
        return 'jpeg/png/webp only.';
    }
    if (error.status === 401) {
        return 'Session expired. Please sign in again.';
    }

    return error.detail || 'Could not upload photos right now. Please try again.';
};

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
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

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

    const showError = (title: string, message: string) => {
        if (Platform.OS === 'web') {
            setErrorMsg(message);
            return;
        }
        Alert.alert(title, message);
    };

    const handleNext = async () => {
        if (nonNullCount < 4) {
            showError('More Photos Required', 'Please add at least 4 photos to continue.');
            return;
        }

        if (!token) {
            showError('Session Expired', 'Please sign in again.');
            return;
        }

        setErrorMsg(null);
        setIsSubmitting(true);
        const selectedPhotos = photos.filter((photo): photo is string => Boolean(photo && photo.trim()));
        setUploadProgress({ current: 0, total: selectedPhotos.length });

        try {
            const uploadedPhotoUrls: string[] = [];

            for (let i = 0; i < selectedPhotos.length; i += 1) {
                const uri = selectedPhotos[i];
                setUploadProgress({ current: i + 1, total: selectedPhotos.length });

                const fileResponse = await fetch(uri);
                if (!fileResponse.ok) {
                    throw createApiRequestError(fileResponse.status, 'Could not read selected photo.');
                }

                const blob = await fileResponse.blob();
                const contentType = (blob.type || guessMimeTypeFromUri(uri) || '').toLowerCase();

                if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
                    throw createApiRequestError(400, 'Unsupported content_type.');
                }

                if (blob.size > MAX_PHOTO_BYTES) {
                    throw createApiRequestError(413, `File too large. Max allowed is ${MAX_PHOTO_BYTES} bytes.`);
                }

                const uploadConfig = await photoUploadUrl(contentType, blob.size, token);
                const requiredHeaders = { ...uploadConfig.required_headers };
                const hasContentTypeHeader = Object.keys(requiredHeaders)
                    .some(headerName => headerName.toLowerCase() === 'content-type');
                if (!hasContentTypeHeader) {
                    requiredHeaders['Content-Type'] = contentType;
                }

                const uploadResponse = await fetch(uploadConfig.upload_url, {
                    method: 'PUT',
                    headers: requiredHeaders,
                    body: blob,
                });

                if (!uploadResponse.ok) {
                    const detail = await parseResponseDetail(uploadResponse, 'Failed to upload photo bytes.');
                    throw createApiRequestError(uploadResponse.status, detail);
                }

                uploadedPhotoUrls.push(uploadConfig.final_url);
            }

            const profilePayload = {
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
                photos: uploadedPhotoUrls,
            };

            const response = await fetch(`${API_BASE_URL}/api/users/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(profilePayload),
            });

            if (!response.ok) {
                const detail = await parseResponseDetail(response, 'Failed to save profile photos.');
                throw createApiRequestError(response.status, detail);
            }

            const nextPhotos: (string | null)[] = [...uploadedPhotoUrls];
            while (nextPhotos.length < 6) {
                nextPhotos.push(null);
            }
            updateData({ photos: nextPhotos.slice(0, 6) });

            await refreshProfile();
            router.replace('/(tabs)/discovery');
        } catch (error: unknown) {
            const msg = photoUploadErrorMessage(error);
            showError('Upload Failed', msg);
        } finally {
            setUploadProgress(null);
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
            {isSubmitting && uploadProgress && (
                <Text style={styles.uploadingText}>
                    Uploading {uploadProgress.current}/{uploadProgress.total}...
                </Text>
            )}

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
    },
    uploadingText: {
        ...TYPOGRAPHY.bodyBase,
        marginTop: SPACING.sm,
        color: COLORS.secondaryText,
        textAlign: 'center',
    }
});
