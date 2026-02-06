import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/Api';
import Skeleton from '../../components/ui/Skeleton';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_HEIGHT = Dimensions.get('window').height * 0.65;

export default function DiscoveryScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    // Animation values
    const cardScale = useSharedValue(1);

    const animatedCardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }]
    }));

    useEffect(() => {
        fetchDiscovery();
    }, [token]);

    const fetchDiscovery = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/discovery?limit=10`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`[Discovery] Loaded ${data.length} profiles`);
                setProfiles(data);
            } else {
                console.warn('[Discovery] Failed to load', res.status);
            }
        } catch (e) {
            console.error('[Discovery] Error', e);
        } finally {
            setLoading(false);
        }
    };

    const currentProfile = profiles[currentIndex];

    // Compute Age
    const age = useMemo(() => {
        if (!currentProfile?.birth_date) return '';
        const birth = new Date(currentProfile.birth_date);
        const diff = Date.now() - birth.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }, [currentProfile]);

    const handlePass = () => {
        if (!currentProfile) return;
        const id = currentProfile.id || currentProfile._id;
        console.log(`PASS: ${id} (${currentProfile.first_name})`);
        nextProfile();
    };

    const handleLike = () => {
        if (!currentProfile) return;
        const id = currentProfile.id || currentProfile._id;
        console.log(`LIKE: ${id} (${currentProfile.first_name})`);
        nextProfile();
    };

    const nextProfile = () => {
        setCurrentIndex(prev => prev + 1);
    };

    const handleViewProfile = () => {
        if (!currentProfile) return;
        const id = currentProfile.id || currentProfile._id;

        // Ensure profile has necessary fields for preview
        const userPayload = JSON.stringify({
            ...currentProfile,
            id: id,
            profile_completion: 80 // fallback
        });

        console.log(`VIEW PROFILE: ${id}`);
        router.push({
            pathname: '/modal/preview-profile',
            params: { user: userPayload }
        });
    };

    const resetDiscovery = () => {
        setCurrentIndex(0);
        fetchDiscovery();
    };

    // ... existing imports ...

    // ... (component code unchanged until return)

    // --- Loading State (Skeleton) ---
    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>blush hour</Text>
                </View>
                <View style={styles.cardContainer}>
                    <View style={[styles.card, { backgroundColor: COLORS.surface }]}>
                        {/* Image Skeleton */}
                        <Skeleton height="100%" width="100%" borderRadius={RADIUS.lg} />

                        {/* Content Overlay Skeleton */}
                        <View style={{ position: 'absolute', bottom: SPACING.lg, left: SPACING.lg, right: SPACING.lg }}>
                            <Skeleton width="60%" height={30} style={{ marginBottom: SPACING.sm }} />
                            <Skeleton width="40%" height={20} style={{ marginBottom: SPACING.sm }} />
                            <Skeleton width="90%" height={15} />
                            <View style={{ marginTop: SPACING.xs }}><Skeleton width="80%" height={15} /></View>
                        </View>
                    </View>

                    {/* Action Buttons Skeleton */}
                    <View style={styles.actionsBar}>
                        <Skeleton width={64} height={64} borderRadius={32} />
                        <Skeleton width={64} height={64} borderRadius={32} />
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // --- Empty State ---
    if (!currentProfile) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.emptyContainer}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="sparkles" size={40} color={COLORS.primary} />
                    </View>
                    <Text style={styles.emptyTitle}>That's everyone for now</Text>
                    <Text style={styles.emptySub}>Check back later for more people.</Text>

                    <TouchableOpacity style={styles.refreshButton} onPress={resetDiscovery}>
                        <Text style={styles.refreshText}>Refresh Feed</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // --- Card View ---
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>blush hour</Text>
                <TouchableOpacity onPress={() => router.push('/modal/filter')}>
                    <Ionicons name="options-outline" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>
            </View>

            <View style={styles.cardContainer}>
                {/* Profile Card */}
                <Animated.View style={[styles.card, animatedCardStyle]}>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={handleViewProfile}
                        onPressIn={() => (cardScale.value = withSpring(0.97))}
                        onPressOut={() => (cardScale.value = withSpring(1))}
                        style={{ flex: 1 }}
                    >
                        <Image
                            source={{ uri: currentProfile.photos?.[0] || 'https://via.placeholder.com/400' }}
                            style={styles.cardImage}
                        />

                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.cardGradient}
                        />

                        <View style={styles.cardContent}>
                            <View style={styles.nameRow}>
                                <Text style={styles.name}>{currentProfile.first_name}, {age}</Text>
                            </View>

                            {currentProfile.work && (
                                <View style={styles.detailRow}>
                                    <Ionicons name="briefcase-outline" size={16} color={COLORS.surface} style={{ marginRight: 6 }} />
                                    <Text style={styles.detailText}>{currentProfile.work}</Text>
                                </View>
                            )}

                            {currentProfile.location && (
                                <View style={styles.detailRow}>
                                    <Ionicons name="location-outline" size={16} color={COLORS.surface} style={{ marginRight: 6 }} />
                                    <Text style={styles.detailText}>{currentProfile.location}</Text>
                                </View>
                            )}

                            <Text style={styles.bio} numberOfLines={2}>
                                {currentProfile.bio}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </Animated.View>

                {/* Actions */}
                <View style={styles.actionsBar}>
                    <TouchableOpacity style={[styles.actionButton, styles.passButton]} onPress={handlePass}>
                        <Ionicons name="close" size={30} color={COLORS.secondaryText} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={handleLike}>
                        <Ionicons name="heart" size={30} color={COLORS.destructive} />
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md,
        backgroundColor: COLORS.background
    },
    headerTitle: {
        ...TYPOGRAPHY.h1,
        color: COLORS.primaryText,
        letterSpacing: -1
    },

    cardContainer: { flex: 1, padding: SPACING.screen, justifyContent: 'center' },

    card: {
        height: CARD_HEIGHT,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.surface,
        overflow: 'hidden',
        position: 'relative',
        ...SHADOWS.card
    },
    cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    cardGradient: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    cardContent: {
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: SPACING.lg
    },
    nameRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: SPACING.xs },
    name: {
        ...TYPOGRAPHY.display,
        fontSize: 32,
        color: '#FFFFFF' // Always white over image
    },

    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
    detailText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.surface,
        fontWeight: '500'
    },

    bio: {
        ...TYPOGRAPHY.bodyBase,
        color: 'rgba(255,255,255,0.9)',
        marginTop: SPACING.sm
    },

    actionsBar: {
        flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center',
        marginTop: SPACING.lg
    },
    actionButton: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: COLORS.background,
        justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.card
    },
    passButton: { borderWidth: 1, borderColor: COLORS.border },
    likeButton: { borderWidth: 1, borderColor: COLORS.primary }, // Gold border

    // Empty State
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: COLORS.surface,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: SPACING.lg
    },
    emptyTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.sm,
        textAlign: 'center'
    },
    emptySub: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        textAlign: 'center',
        marginBottom: SPACING.section
    },
    refreshButton: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.surface,
        borderRadius: RADIUS.pill
    },
    refreshText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primaryText
    }
});
