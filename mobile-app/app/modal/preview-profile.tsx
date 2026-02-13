import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = SPACING.sm;
// 3 columns: (Width - (2 * gap) - (2 * padding)) / 3
const PHOTO_SIZE = (SCREEN_WIDTH - (GAP * 2) - 32) / 3;

export default function PreviewProfileScreen() {
    const router = useRouter();
    const { user: authUser } = useAuth();
    const params = useLocalSearchParams();

    // Debug Mount
    useEffect(() => {
        console.log('[Preview] mounted');
    }, []);

    // Determine User Data source
    const userData = useMemo(() => {
        if (params.user) {
            try {
                // Determine if it comes as string or object (Expo router nuances)
                const parsed = typeof params.user === 'string' ? JSON.parse(params.user) : params.user;
                return parsed || {};
            } catch (e) {
                console.error("Failed to parse user param", e);
                return authUser || {};
            }
        }
        return authUser || {};
    }, [params.user, authUser]);

    // --- Derived Data ---
    const completion = userData.profile_completion || 0;
    const languages = Array.isArray(userData.languages)
        ? userData.languages.filter((item: any) => typeof item === 'string' && item.trim().length > 0)
        : [];
    const habits = userData.habits && typeof userData.habits === 'object' ? userData.habits : {};
    const kidsValue = [userData.kids_have, userData.kids_want]
        .filter((value: any) => typeof value === 'string' && value.trim().length > 0)
        .join(", ");

    const age = useMemo(() => {
        if (!userData.birth_date) return null;
        const birth = new Date(userData.birth_date);
        const diff = Date.now() - birth.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    }, [userData.birth_date]);

    // Prepare Photos (fixed 6 slots)
    const photos = useMemo(() => {
        const raw = userData.photos || [];
        // Ensure exactly 6 items, filling with null
        return [...raw, ...Array(6)].slice(0, 6);
    }, [userData.photos]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-down" size={30} color={COLORS.primaryText} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Preview</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Section 1: Profile Strength */}
                <View style={styles.strengthCard}>
                    <View style={styles.strengthRow}>
                        <Text style={styles.strengthTitle}>Profile strength</Text>
                    </View>
                    <View style={styles.strengthBarContainer}>
                        <Text style={styles.strengthPercent}>{completion}% complete</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.primaryText} />
                    </View>
                </View>

                {/* Section 2: Photos (3x2 Grid) */}
                <Text style={styles.sectionTitle}>Photos and videos</Text>
                <Text style={styles.sectionSubtitle}>Pick some that show the true you.</Text>

                <View style={styles.photoGrid}>
                    {photos.map((uri, index) => (
                        <View key={index} style={[styles.photoSlot, { width: PHOTO_SIZE, height: PHOTO_SIZE * 1.2 }]}>
                            {uri ? (
                                <Image source={{ uri }} style={styles.photoImage} />
                            ) : (
                                <View style={styles.emptySlot}>
                                    <Text style={styles.emptySlotText}>{index + 1}</Text>
                                </View>
                            )}
                            {index === 0 && uri && (
                                <View style={styles.mainBadge}>
                                    <Text style={styles.mainBadgeText}>Main</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>

                {/* Section 3: Bio */}
                <Text style={styles.sectionTitle}>Bio</Text>
                <View style={styles.card}>
                    {userData.bio ? (
                        <Text style={styles.bioText}>{userData.bio}</Text>
                    ) : (
                        <Text style={styles.placeholderText}>Write a fun and punchy intro.</Text>
                    )}
                </View>

                {/* Section 4: About You */}
                <Text style={styles.sectionTitle}>About you</Text>
                <View style={styles.infoList}>
                    <InfoRow icon="calendar-outline" label="Age" value={age ? `${age}` : null} />
                    <InfoRow icon="briefcase-outline" label="Work" value={userData.work} />
                    <InfoRow icon="school-outline" label="Education" value={userData.education} />
                    <InfoRow icon="person-outline" label="Gender" value={userData.gender} />
                    <InfoRow icon="location-outline" label="Location" value={userData.location} />
                    <InfoRow icon="home-outline" label="Hometown" value={userData.hometown} />
                </View>

                {/* Section 5: Languages */}
                <Text style={styles.sectionTitle}>Languages</Text>
                <ChipGroup items={languages} emptyLabel="Not specified" />

                {/* Section 6: Habits */}
                <Text style={styles.sectionTitle}>Habits</Text>
                <View style={styles.infoList}>
                    <InfoRowWithFallback icon="wine-outline" label="Drinking" value={habits.drinking} />
                    <InfoRowWithFallback icon="cafe-outline" label="Smoking" value={habits.smoking} />
                    <InfoRowWithFallback icon="barbell-outline" label="Exercise" value={habits.exercise} />
                    <InfoRowWithFallback icon="happy-outline" label="Kids" value={kidsValue} />
                </View>

                {/* Section 7: More About You */}
                <Text style={styles.sectionTitle}>More about you</Text>
                <View style={styles.infoList}>
                    <InfoRow icon="resize-outline" label="Height" value={userData.height} />
                    <InfoRow icon="book-outline" label="Education level" value={userData.education_level} />
                    <InfoRow icon="heart-outline" label="Looking for" value={userData.dating_preference} />
                    <InfoRow icon="star-outline" label="Star sign" value={userData.star_sign} />
                    <InfoRow icon="flag-outline" label="Politics" value={userData.politics} />
                    <InfoRow icon="hand-left-outline" label="Religion" value={userData.religion} />
                </View>

                {/* Section 8: Interests */}
                <Text style={styles.sectionTitle}>Interests</Text>
                <ChipGroup items={userData.interests} emptyLabel="Add interests" />

                <Text style={styles.sectionTitle}>Values</Text>
                <ChipGroup items={userData.values} emptyLabel="Add values" />

                <Text style={styles.sectionTitle}>Causes</Text>
                <ChipGroup items={userData.causes} emptyLabel="Add causes" />

                {/* Section 9: Prompts */}
                <Text style={styles.sectionTitle}>Prompts</Text>
                {userData.prompts && userData.prompts.length > 0 ? (
                    userData.prompts.map((p: any, i: number) => (
                        <View key={i} style={styles.promptCard}>
                            <Text style={styles.promptQuestion}>{p.question}</Text>
                            <Text style={styles.promptAnswer}>{p.answer}</Text>
                        </View>
                    ))
                ) : (
                    <View style={styles.card}>
                        <Text style={styles.placeholderText}>Add prompts to show your personality.</Text>
                    </View>
                )}

                <View style={{ height: 60 }} />

            </ScrollView>
        </SafeAreaView>
    );
}

// --- Sub Components ---

const InfoRow = ({ icon, label, value }: { icon: any, label: string, value: string | null | undefined }) => (
    <View style={styles.row}>
        <View style={styles.rowLeft}>
            <Ionicons name={icon} size={20} color={COLORS.secondaryText} style={{ marginRight: SPACING.md, width: 20 }} />
            <Text style={styles.rowLabel}>{label}</Text>
        </View>
        <View style={styles.rowRight}>
            <Text style={[styles.rowValue, !value && styles.placeholderValue]}>
                {value || "Add"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.disabledText} style={{ marginLeft: SPACING.sm }} />
        </View>
    </View>
);

const InfoRowWithFallback = ({ icon, label, value, emptyLabel = "Not specified" }: { icon: any, label: string, value: string | null | undefined, emptyLabel?: string }) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    const displayValue = normalized.length > 0 ? normalized : emptyLabel;
    const isMissing = normalized.length === 0;
    return (
        <View style={styles.row}>
            <View style={styles.rowLeft}>
                <Ionicons name={icon} size={20} color={COLORS.secondaryText} style={{ marginRight: SPACING.md, width: 20 }} />
                <Text style={styles.rowLabel}>{label}</Text>
            </View>
            <View style={styles.rowRight}>
                <Text style={[styles.rowValue, isMissing && styles.placeholderValue]}>
                    {displayValue}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.disabledText} style={{ marginLeft: SPACING.sm }} />
            </View>
        </View>
    );
};

const ChipGroup = ({ items, emptyLabel }: { items: string[] | undefined, emptyLabel: string }) => {
    if (!items || items.length === 0) {
        return (
            <View style={styles.card}>
                <Text style={styles.placeholderText}>{emptyLabel}</Text>
            </View>
        );
    }
    return (
        <View style={styles.chipContainer}>
            {items.map((item, i) => (
                <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                </View>
            ))}
        </View>
    );
};

// --- Styles ---

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: SPACING.screen, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border
    },
    headerTitle: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText },
    backButton: { padding: 4 },

    scrollContent: { paddingBottom: 40 },

    // Strength
    strengthCard: {
        margin: SPACING.screen, padding: SPACING.lg, backgroundColor: COLORS.background,
        borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
        ...SHADOWS.small
    },
    strengthRow: { marginBottom: SPACING.sm },
    strengthTitle: { ...TYPOGRAPHY.h2, fontSize: 16, color: COLORS.primaryText },
    strengthBarContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    strengthPercent: { fontSize: 14, color: COLORS.primaryText, fontWeight: '500' },

    // Section Headers
    sectionTitle: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText, marginLeft: SPACING.screen, marginTop: SPACING.xl, marginBottom: 4 },
    sectionSubtitle: { ...TYPOGRAPHY.bodyBase, fontSize: 14, color: COLORS.secondaryText, marginLeft: SPACING.screen, marginBottom: SPACING.lg },

    // Photos
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.screen, gap: GAP },
    photoSlot: { borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: COLORS.surface, position: 'relative' },
    photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    emptySlot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },
    emptySlotText: { fontSize: 24, color: COLORS.disabledText, fontWeight: '700' },
    mainBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
    mainBadgeText: { color: 'white', fontSize: 10, fontWeight: '600' },

    // Bio & Cards
    card: { marginHorizontal: SPACING.screen, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, marginTop: SPACING.sm },
    bioText: { ...TYPOGRAPHY.bodyBase, color: COLORS.primaryText },
    placeholderText: { ...TYPOGRAPHY.bodyBase, color: COLORS.disabledText, fontStyle: 'italic' },

    // Info Rows
    infoList: { marginTop: SPACING.sm },
    row: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 14, paddingHorizontal: SPACING.screen
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center' },
    rowLabel: { fontSize: 16, color: COLORS.primaryText },
    rowRight: { flexDirection: 'row', alignItems: 'center' },
    rowValue: { fontSize: 16, color: COLORS.primaryText, maxWidth: 150, textAlign: 'right' },
    placeholderValue: { color: COLORS.disabledText },

    // Chips
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.screen, marginTop: SPACING.sm, gap: SPACING.sm },
    chip: {
        paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary
    },
    chipText: { fontSize: 14, color: COLORS.primaryText, fontWeight: '500' },

    // Prompts
    promptCard: {
        marginHorizontal: SPACING.screen, marginTop: SPACING.sm, padding: SPACING.xl,
        backgroundColor: COLORS.surface, borderRadius: RADIUS.lg
    },
    promptQuestion: { fontSize: 14, color: COLORS.secondaryText, marginBottom: SPACING.sm },
    promptAnswer: { fontSize: 18, color: COLORS.primaryText, fontWeight: '500' }
});
