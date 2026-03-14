import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Card } from '../../components/ui/Card';

const SCREEN_WIDTH = Dimensions.get('window').width;

const AvatarView = ({ uri, completion }: { uri: string | null, completion?: number }) => {
    const showCompletion = typeof completion === 'number';
    // A simplified visual ring representation
    return (
        <View style={styles.avatarContainer}>
            <View style={styles.ringBack}>
                <LinearGradient
                    colors={[COLORS.primary, COLORS.primary]}
                    style={[styles.ringGradient, { opacity: completion && completion > 0 ? 1 : 0.3 }]}
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
            {showCompletion && (
                <View style={styles.completionBadge}>
                    <Text style={styles.completionText}>{completion}%</Text>
                </View>
            )}
        </View>
    );
};

export default function ProfileHubScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();

    // Derived Data
    const displayPhoto = user?.photos && user.photos.length > 0 ? user.photos[0] : null;
    const profileStrength = user?.profile_strength;
    const completionPercent = profileStrength?.completion_percent;
    const tier = profileStrength?.tier;
    const missingFields = profileStrength?.missing_fields || [];
    const hasStrength = completionPercent !== undefined && completionPercent !== null && typeof tier === 'string';

    const age = useMemo(() => {
        if (!user?.birth_date) return '';
        const birth = new Date(user.birth_date);
        const diff = Date.now() - birth.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }, [user?.birth_date]);

    const languages = user?.languages ?? [];
    const habits = user?.habits ?? {};
    const habitItems = [
        { key: 'drinking', label: 'Drinking', value: habits.drinking },
        { key: 'smoking', label: 'Smoking', value: habits.smoking },
        { key: 'exercise', label: 'Exercise', value: habits.exercise },
        { key: 'kids', label: 'Kids', value: habits.kids }
    ];
    const visibleHabits = habitItems.filter((item) => item.value);
    const hasHabits = visibleHabits.length > 0;
    const hasLanguages = languages.length > 0;

    // Handle Edit Navigation
    const onEditPress = () => {
        router.push("/modal/edit-profile");
    };

    // Handle Preview Navigation
    const onPreviewPress = () => {
        console.log('[ProfileHub] Preview pressed');
        router.push("/modal/preview-profile");
    };

    const onPassesPress = () => {
        router.push('/passes');
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
                    <Ionicons name="settings-outline" size={24} color={COLORS.secondaryText} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Profile Strength Card */}
                {hasStrength && (
                    <Card style={styles.strengthCard}>
                        <View style={styles.strengthHeader}>
                            <Text style={styles.strengthTitle}>Profile Strength</Text>
                            <View style={[styles.tierBadge, { backgroundColor: tier === 'Gold' ? '#FFD700' : tier === 'Silver' ? '#C0C0C0' : '#CD7F32' }]}>
                                <Text style={[styles.tierText, tier === 'Gold' && { color: '#0D0A14' }]}>{tier}</Text>
                            </View>
                        </View>

                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${completionPercent!}%`, backgroundColor: '#FF6B9D' }]} />
                            </View>
                            <Text style={styles.progressText}>{completionPercent!}% complete</Text>
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
                                            <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {completionPercent! < 80 && (
                            <Text style={styles.warningText}>Complete your profile to unlock Chat Night.</Text>
                        )}
                    </Card>
                )}

                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <AvatarView uri={displayPhoto} completion={hasStrength ? completionPercent : undefined} />
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
                            <Ionicons name="pencil" size={24} color={COLORS.primary} />
                        </View>
                        <Text style={styles.actionLabel}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onPreviewPress}
                        activeOpacity={0.7}
                    >
                        <View style={styles.iconCircle}>
                            <Ionicons name="eye-outline" size={24} color={COLORS.primary} />
                        </View>
                        <Text style={styles.actionLabel}>Preview</Text>
                    </TouchableOpacity>
                </View>

                {/* Languages & Habits */}
                <View style={styles.detailsSection}>
                    <TouchableOpacity onPress={onPassesPress} activeOpacity={0.8}>
                        <Card style={styles.passesEntryCard}>
                            <View style={styles.passesEntryRow}>
                                <View style={styles.passesEntryIcon}>
                                    <Ionicons name="ticket-outline" size={22} color={COLORS.primary} />
                                </View>
                                <View style={styles.passesEntryCopy}>
                                    <Text style={styles.passesEntryTitle}>Passes</Text>
                                    <Text style={styles.passesEntrySubtitle}>See paid pass credits and available pass packs.</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={COLORS.secondaryText} />
                            </View>
                        </Card>
                    </TouchableOpacity>

                    <Card style={styles.detailCard}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Languages</Text>
                            <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
                                <Text style={styles.sectionAction}>{hasLanguages ? 'Edit' : 'Add'}</Text>
                            </TouchableOpacity>
                        </View>
                        {hasLanguages ? (
                            <View style={styles.chipRow}>
                                {languages.map((language) => (
                                    <View key={language} style={styles.chip}>
                                        <Text style={styles.chipText}>{language}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
                                <Text style={styles.emptyText}>Add languages</Text>
                            </TouchableOpacity>
                        )}
                    </Card>

                    <Card style={styles.detailCard}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Habits</Text>
                            <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
                                <Text style={styles.sectionAction}>{hasHabits ? 'Edit' : 'Add'}</Text>
                            </TouchableOpacity>
                        </View>
                        {hasHabits ? (
                            <View style={styles.habitList}>
                                {visibleHabits.map((habit) => (
                                    <View key={habit.key} style={styles.habitRow}>
                                        <Text style={styles.habitLabel}>{habit.label}</Text>
                                        <Text style={styles.habitValue}>{habit.value}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <TouchableOpacity onPress={onEditPress} activeOpacity={0.7}>
                                <Text style={styles.emptyText}>Add habits</Text>
                            </TouchableOpacity>
                        )}
                    </Card>
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
                        colors={['#C44569', '#FF6B9D']}
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
                        <TouchableOpacity style={[styles.upsellButton, { backgroundColor: '#F5F0FF' }]}>
                            <Text style={[styles.upsellButtonText, { color: '#C44569' }]}>Upgrade</Text>
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
    ringBack: {
        position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 3, borderColor: '#FF6B9D',
        shadowColor: '#FF6B9D', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 6
    },
    ringGradient: { position: 'absolute', width: 154, height: 154, borderRadius: 77, borderWidth: 2, borderColor: '#FF6B9D' },
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
    actionRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.xl, gap: SPACING.md },
    actionButton: {
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#2D2440', borderRadius: RADIUS.pill,
        paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, minWidth: 130
    },
    iconCircle: {
        width: 34, height: 34, borderRadius: 17, backgroundColor: 'transparent',
        justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs
    },
    actionLabel: { ...TYPOGRAPHY.bodyBase, color: COLORS.secondaryText, fontSize: 14 },

    // Languages & Habits
    detailsSection: { paddingHorizontal: SPACING.screen, gap: SPACING.md, marginBottom: SPACING.xl },
    passesEntryCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#2D2440', borderRadius: RADIUS.lg },
    passesEntryRow: { flexDirection: 'row', alignItems: 'center' },
    passesEntryIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,107,157,0.12)'
    },
    passesEntryCopy: { flex: 1, marginLeft: SPACING.md, marginRight: SPACING.md },
    passesEntryTitle: { ...TYPOGRAPHY.h2, fontSize: 16, color: COLORS.primaryText, fontWeight: '600' },
    passesEntrySubtitle: { ...TYPOGRAPHY.caption, color: COLORS.secondaryText },
    detailCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#2D2440', borderRadius: RADIUS.lg },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    sectionTitle: { ...TYPOGRAPHY.h2, fontSize: 16, color: COLORS.primaryText, fontWeight: '600' },
    sectionAction: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface
    },
    chipText: { fontSize: 12, color: COLORS.secondaryText },
    habitList: { gap: 8 },
    habitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    habitLabel: { fontSize: 13, color: COLORS.secondaryText },
    habitValue: { fontSize: 13, color: COLORS.secondaryText },
    emptyText: { fontSize: 13, color: COLORS.disabledText },

    // Upsell
    upsellContainer: { paddingHorizontal: SPACING.screen },
    upsellCard: {
        flexDirection: 'row', alignItems: 'center', padding: SPACING.card, borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: '#2D2440'
    },
    upsellIcon: { marginRight: SPACING.lg },
    upsellText: { flex: 1 },
    upsellTitle: { ...TYPOGRAPHY.h2, fontSize: 16, color: COLORS.primaryText },
    upsellSub: { ...TYPOGRAPHY.bodyBase, fontSize: 13, color: COLORS.secondaryText },
    upsellButton: {
        backgroundColor: '#FF6B9D', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill
    },
    upsellButtonText: { color: '#F5F0FF', fontWeight: 'bold', fontSize: 12 },

    // Profile Strength
    strengthCard: {
        marginHorizontal: SPACING.screen,
        marginTop: SPACING.md,
        marginBottom: SPACING.lg,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: '#2D2440',
        borderRadius: RADIUS.lg
    },
    strengthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    strengthTitle: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText },
    tierBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    tierText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    progressContainer: { marginBottom: SPACING.md },
    progressBarBg: { height: 8, backgroundColor: '#2D2440', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    progressText: { marginTop: 4, fontSize: 12, color: COLORS.secondaryText, textAlign: 'right' },
    missingFieldsContainer: { marginTop: SPACING.sm },
    missingTitle: { fontSize: 14, fontWeight: '600', color: COLORS.secondaryText, marginBottom: 8 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    missingChip: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,107,157,0.10)',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill,
        borderWidth: 1, borderColor: '#2D2440', gap: 4
    },
    missingChipText: { fontSize: 12, color: COLORS.primaryText, fontWeight: '500' },
    warningText: { marginTop: SPACING.lg, color: COLORS.destructive, fontSize: 13, fontWeight: '600', textAlign: 'center' }
});
