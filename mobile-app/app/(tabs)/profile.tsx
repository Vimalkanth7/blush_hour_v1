import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;

const AvatarView = ({ uri, completion }: { uri: string | null, completion: number }) => {
    // A simplified visual ring representation
    return (
        <View style={styles.avatarContainer}>
            <View style={styles.ringBack}>
                <LinearGradient
                    colors={[COLORS.primary, COLORS.primary]}
                    style={[styles.ringGradient, { opacity: completion > 0 ? 1 : 0.3 }]}
                />
            </View>
            <View style={styles.imageContainer}>
                {uri ? (
                    <Image source={{ uri }} style={styles.avatarImage} />
                ) : (
                    <View style={styles.placeholderAvatar}>
                        <Ionicons name="person" size={80} color={COLORS.disabledText} />
                    </View>
                )}
            </View>
            <View style={styles.completionBadge}>
                <Text style={styles.completionText}>{completion}%</Text>
            </View>
        </View>
    );
};

export default function ProfileHubScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();

    // Derived Data
    const displayPhoto = user?.photos && user.photos.length > 0 ? user.photos[0] : null;
    const completion = user?.profile_strength?.completion_percent || user?.profile_completion || 0;
    const tier = user?.profile_strength?.tier || (completion >= 80 ? 'Gold' : completion >= 50 ? 'Silver' : 'Bronze');
    const missingFields = user?.profile_strength?.missing_fields || [];

    const age = useMemo(() => {
        if (!user?.birth_date) return '';
        const birth = new Date(user.birth_date);
        const diff = Date.now() - birth.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }, [user?.birth_date]);

    // Handle Edit Navigation
    const onEditPress = () => {
        router.push("/modal/edit-profile");
    };

    // Handle Preview Navigation
    const onPreviewPress = () => {
        console.log('[ProfileHub] Preview pressed');
        router.push("/modal/preview-profile");
    };

    const handleFixField = (field: string) => {
        console.log(`[ProfileHub] Fixing field: ${field}`);
        const isOnboarded = user?.onboarding_completed;

        if (isOnboarded) {
            switch (field) {
                case 'photos':
                    router.push("/modal/edit-profile");
                    break;
                case 'prompts':
                    router.push({ pathname: "/modal/edit-profile", params: { initialSection: 'prompts' } });
                    break;
                case 'interests':
                    router.push({ pathname: "/modal/edit-profile", params: { initialSection: 'interests' } });
                    break;
                default:
                    router.push("/modal/edit-profile");
            }
            return;
        }

        switch (field) {
            case 'photos':
                // Try Onboarding photos if available, else Edit Profile
                router.push("/modal/edit-profile");
                break;
            case 'bio':
            case 'basics':
                router.push("/modal/edit-profile");
                break;
            case 'interests':
                router.push("/(onboarding)/interests");
                break;
            case 'prompts':
                router.push("/(onboarding)/prompts");
                break;
            default:
                router.push("/modal/edit-profile");
        }
    };

    const getFieldLabel = (field: string) => {
        const map: Record<string, string> = {
            photos: "Add photos",
            bio: "Write a bio",
            interests: "Pick interests",
            prompts: "Answer prompts",
            basics: "Complete basics",
            location: "Add location"
        };
        return map[field] || `Add ${field}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Top Bar */}
            <View style={styles.topBar}>
                <Text style={styles.headerTitle}>Profile</Text>
                <TouchableOpacity onPress={signOut} style={{ padding: SPACING.sm }}>
                    <Ionicons name="settings-outline" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Profile Strength Card */}
                {completion < 100 && (
                    <View style={styles.strengthCard}>
                        <View style={styles.strengthHeader}>
                            <Text style={styles.strengthTitle}>Profile Strength</Text>
                            <View style={[styles.tierBadge, { backgroundColor: tier === 'Gold' ? '#FFD700' : tier === 'Silver' ? '#C0C0C0' : '#CD7F32' }]}>
                                <Text style={styles.tierText}>{tier}</Text>
                            </View>
                        </View>

                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${completion}%`, backgroundColor: tier === 'Gold' ? '#DAA520' : COLORS.primary }]} />
                            </View>
                            <Text style={styles.progressText}>{completion}% complete</Text>
                        </View>

                        {missingFields.length > 0 && (
                            <View style={styles.missingFieldsContainer}>
                                <Text style={styles.missingTitle}>To do:</Text>
                                <View style={styles.chipsRow}>
                                    {missingFields.map((field) => (
                                        <TouchableOpacity
                                            key={field}
                                            style={styles.missingChip}
                                            onPress={() => handleFixField(field)}
                                        >
                                            <Text style={styles.missingChipText}>{getFieldLabel(field)}</Text>
                                            <Ionicons name="arrow-forward" size={12} color={COLORS.brandBase} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {completion < 80 && (
                            <Text style={styles.warningText}>Complete your profile to unlock Chat Night.</Text>
                        )}
                    </View>
                )}

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <AvatarView uri={displayPhoto} completion={completion} />
                    <Text style={styles.nameText}>{user?.first_name}, {age}</Text>
                </View>

                {/* Primary Actions */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onEditPress}
                        activeOpacity={0.7}
                    >
                        <View style={styles.iconCircle}>
                            <Ionicons name="pencil" size={24} color={COLORS.primaryText} />
                        </View>
                        <Text style={styles.actionLabel}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onPreviewPress}
                        activeOpacity={0.7}
                    >
                        <View style={styles.iconCircle}>
                            <Ionicons name="eye-outline" size={24} color={COLORS.primaryText} />
                        </View>
                        <Text style={styles.actionLabel}>Preview</Text>
                    </TouchableOpacity>
                </View>

                {/* Marketing / Upsell Section */}
                <View style={styles.upsellContainer}>
                    <LinearGradient
                        colors={[COLORS.surface, COLORS.surface]}
                        style={styles.upsellCard}
                    >
                        <View style={styles.upsellIcon}>
                            <Ionicons name="rocket" size={30} color={COLORS.primary} />
                        </View>
                        <View style={styles.upsellText}>
                            <Text style={styles.upsellTitle}>Get Spotlight</Text>
                            <Text style={styles.upsellSub}>Be seen by more people today.</Text>
                        </View>
                        <TouchableOpacity style={styles.upsellButton}>
                            <Text style={styles.upsellButtonText}>Get</Text>
                        </TouchableOpacity>
                    </LinearGradient>

                    <View style={{ height: SPACING.md }} />

                    <LinearGradient
                        colors={[COLORS.surface, COLORS.primary]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.upsellCard, { opacity: 0.9 }]}
                    >
                        <View style={styles.upsellIcon}>
                            <Ionicons name="heart" size={30} color={COLORS.primaryText} />
                        </View>
                        <View style={styles.upsellText}>
                            <Text style={[styles.upsellTitle, { color: COLORS.primaryText }]}>Premium</Text>
                            <Text style={[styles.upsellSub, { color: COLORS.primaryText }]}>See who likes you.</Text>
                        </View>
                        <TouchableOpacity style={[styles.upsellButton, { backgroundColor: COLORS.background }]}>
                            <Text style={[styles.upsellButtonText, { color: COLORS.primaryText }]}>Upgrade</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
                <Text style={{ textAlign: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xl, color: COLORS.disabledText, fontSize: 10 }}>v0.9.1 - Profile Hub (Verified)</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    topBar: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: SPACING.screen, paddingVertical: SPACING.sm
    },
    headerTitle: { ...TYPOGRAPHY.h1, color: COLORS.primaryText },
    scrollContent: { paddingBottom: 50 },

    // Hero
    heroSection: { alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.section },
    avatarContainer: { width: 160, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.lg },
    ringBack: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: COLORS.border },
    ringGradient: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 4, borderColor: 'transparent' },
    imageContainer: { width: 140, height: 140, borderRadius: 70, overflow: 'hidden', backgroundColor: COLORS.surface, elevation: 5 },
    avatarImage: { width: '100%', height: '100%' },
    placeholderAvatar: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    completionBadge: {
        position: 'absolute', bottom: 5, backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm,
        ...SHADOWS.small
    },
    completionText: { fontSize: 12, fontWeight: 'bold', color: COLORS.primaryText },
    nameText: { ...TYPOGRAPHY.h1, color: COLORS.primaryText },

    // Actions
    actionRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.xl },
    actionButton: { alignItems: 'center', marginHorizontal: SPACING.xxl },
    iconCircle: {
        width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.surface,
        justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
        ...SHADOWS.small
    },
    actionLabel: { ...TYPOGRAPHY.bodyBase, color: COLORS.secondaryText, fontSize: 14 },

    // Upsell
    upsellContainer: { paddingHorizontal: SPACING.screen },
    upsellCard: {
        flexDirection: 'row', alignItems: 'center', padding: SPACING.card, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: COLORS.border
    },
    upsellIcon: { marginRight: SPACING.lg },
    upsellText: { flex: 1 },
    upsellTitle: { ...TYPOGRAPHY.h2, fontSize: 16, color: COLORS.primaryText },
    upsellSub: { ...TYPOGRAPHY.bodyBase, fontSize: 13, color: COLORS.secondaryText },
    upsellButton: {
        backgroundColor: COLORS.primaryText, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill
    },
    upsellButtonText: { color: COLORS.background, fontWeight: 'bold', fontSize: 12 },

    // Profile Strength
    strengthCard: {
        marginHorizontal: SPACING.screen, marginTop: SPACING.md, marginBottom: SPACING.lg, padding: SPACING.card,
        backgroundColor: COLORS.surface, borderRadius: RADIUS.md, ...SHADOWS.card,
        borderWidth: 1, borderColor: COLORS.border
    },
    strengthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    strengthTitle: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText },
    tierBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    tierText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    progressContainer: { marginBottom: SPACING.md },
    progressBarBg: { height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    progressText: { marginTop: 4, fontSize: 12, color: COLORS.secondaryText, textAlign: 'right' },
    missingFieldsContainer: { marginTop: SPACING.sm },
    missingTitle: { fontSize: 14, fontWeight: '600', color: COLORS.secondaryText, marginBottom: 8 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    missingChip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill,
        borderWidth: 1, borderColor: COLORS.brandBase, gap: 4
    },
    missingChipText: { fontSize: 12, color: COLORS.brandBase, fontWeight: '500' },
    warningText: { marginTop: SPACING.lg, color: COLORS.destructive, fontSize: 13, fontWeight: '600', textAlign: 'center' }
});
