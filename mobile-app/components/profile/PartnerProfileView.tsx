import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Platform, TouchableOpacity, LayoutAnimation, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = SPACING.sm;

export interface PartnerProfile {
    id: string;
    first_name?: string;
    age?: number | string;
    photos?: string[];
    bio?: string;
    interests?: string[];
    values?: string[];
    causes?: string[];
    languages?: string[];
    prompts?: Array<{ question?: string; answer?: string } | any>;
    birth_date?: string;
    work?: string;
    education?: string;
    gender?: string;
    location?: string;
    hometown?: string;
    height?: string;
    habits?: {
        exercise?: string;
        drinking?: string;
        smoking?: string;
    };
    education_level?: string;
    dating_preference?: string;
    kids_have?: string;
    kids_want?: string;
    star_sign?: string;
    politics?: string;
    religion?: string;
}

interface Props {
    profile: PartnerProfile;
    fallbackName?: string;
    fallbackAge?: number | string;
    fallbackPhoto?: string;
    containerWidth?: number;
}

export default function PartnerProfileView({ profile, fallbackName, fallbackAge, fallbackPhoto, containerWidth }: Props) {

    // Determine effective width for grid calc
    // Enable LayoutAnimation on Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const { width } = Dimensions.get('window');

    const effectiveWidth = containerWidth || (Platform.OS === 'web' ? 420 : SCREEN_WIDTH);
    // 3 columns: (Width - (2 * gap) - (2 * padding)) / 3
    // We assume paddingHorizontal is SPACING.screen (16 or 20). Let's use 16.
    const PADDING = 16;
    const PHOTO_SIZE = (effectiveWidth - (GAP * 2) - (PADDING * 2)) / 3;

    // Toggle State
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

    // Derived Data
    const displayName = profile.first_name || fallbackName || "Unknown";
    const displayAge = profile.age || fallbackAge || "";
    const languages = Array.isArray(profile?.languages)
        ? profile.languages.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [];
    const habits = (profile?.habits ?? {}) as NonNullable<PartnerProfile['habits']>;
    const kidsValue = [profile.kids_have, profile.kids_want]
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .join(", ");

    // Photos
    const photos = useMemo(() => {
        const raw = profile.photos && profile.photos.length > 0 ? profile.photos : (fallbackPhoto ? [fallbackPhoto] : []);
        // Ensure exactly 6 items for grid layout, or just map what we have? Preview uses 6 slots.
        // Let's just show what we have, plus maybe placeholders if very few?
        // Preview forces 6. Let's force 6 to match look.
        return [...raw, ...Array(6)].slice(0, 6);
    }, [profile.photos, fallbackPhoto]);

    const hasInterests = profile.interests && profile.interests.length > 0;
    const hasValues = profile.values && profile.values.length > 0;
    const hasCauses = profile.causes && profile.causes.length > 0;
    const hasPrompts = profile.prompts && profile.prompts.length > 0;

    return (
        <View style={styles.container}>
            {/* Header / Name */}
            <View style={styles.headerSection}>
                <Text style={styles.nameText}>{displayName}, {displayAge}</Text>
            </View>

            {/* Photos Grid */}
            <View style={styles.photoGrid}>
                {photos.map((uri, index) => (
                    <View key={index} style={[styles.photoSlot, { width: PHOTO_SIZE, height: PHOTO_SIZE * 1.2 }]}>
                        {uri ? (
                            <Image source={{ uri }} style={styles.photoImage} />
                        ) : (
                            <View style={styles.emptySlot}>
                                {/* <Text style={styles.emptySlotText}>{index + 1}</Text> */}
                                {/* Hide numbers for partner view, just grey slot */}
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

            {/* Bio */}
            <Text style={styles.sectionTitle}>Bio</Text>
            <View style={styles.card}>
                <Text style={profile.bio ? styles.bioText : styles.placeholderText}>
                    {profile.bio || "No bio yet."}
                </Text>
            </View>

            {/* About You */}
            <Text style={styles.sectionTitle}>About {displayName}</Text>
            <View style={styles.infoList}>
                {/* Age is already in header, but maybe list it? Preview lists it. */}
                <InfoRow icon="calendar-outline" label="Age" value={displayAge ? `${displayAge}` : null} />
                <InfoRow icon="briefcase-outline" label="Work" value={profile.work} />
                <InfoRow icon="school-outline" label="Education" value={profile.education} />
                <InfoRow icon="person-outline" label="Gender" value={profile.gender} />
                <InfoRow icon="location-outline" label="Location" value={profile.location} />
                <InfoRow icon="home-outline" label="Hometown" value={profile.hometown} />
            </View>

            {/* Languages */}
            <Text style={styles.sectionTitle}>Languages</Text>
            <ChipGroup items={languages} emptyLabel="Not specified" />

            {/* Habits */}
            <Text style={styles.sectionTitle}>Habits</Text>
            <View style={styles.infoList}>
                <InfoRowWithFallback icon="wine-outline" label="Drinking" value={habits.drinking} />
                <InfoRowWithFallback icon="cafe-outline" label="Smoking" value={habits.smoking} />
                <InfoRowWithFallback icon="barbell-outline" label="Exercise" value={habits.exercise} />
                <InfoRowWithFallback icon="happy-outline" label="Kids" value={kidsValue} />
            </View>

            {/* More About You - Interactive */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsDetailsExpanded(!isDetailsExpanded);
                }}
                style={styles.sectionHeaderClickable}
            >
                <Text style={styles.sectionTitleClickable}>More details</Text>
                <Ionicons
                    name={isDetailsExpanded ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={COLORS.primaryText}
                    style={{ marginRight: 16 }}
                />
            </TouchableOpacity>

            {isDetailsExpanded && (
                <View style={styles.infoList}>
                    <InfoRow icon="resize-outline" label="Height" value={profile.height} />
                    <InfoRow icon="book-outline" label="Education level" value={profile.education_level} />
                    <InfoRow icon="heart-outline" label="Looking for" value={profile.dating_preference} />
                    <InfoRow icon="star-outline" label="Star sign" value={profile.star_sign} />
                    <InfoRow icon="flag-outline" label="Politics" value={profile.politics} />
                    <InfoRow icon="hand-left-outline" label="Religion" value={profile.religion} />
                </View>
            )}
            {/* Chips Sections */}
            {hasInterests && (
                <>
                    <Text style={styles.sectionTitle}>Interests</Text>
                    <ChipGroup items={profile.interests} />
                </>
            )}

            {hasValues && (
                <>
                    <Text style={styles.sectionTitle}>Values</Text>
                    <ChipGroup items={profile.values} />
                </>
            )}

            {hasCauses && (
                <>
                    <Text style={styles.sectionTitle}>Causes</Text>
                    <ChipGroup items={profile.causes} />
                </>
            )}

            {/* Prompts */}
            {hasPrompts && (
                <>
                    <Text style={styles.sectionTitle}>Prompts</Text>
                    {profile.prompts!.map((p: any, i: number) => (
                        <View key={i} style={styles.promptCard}>
                            <Text style={styles.promptQuestion}>{p.question || "Response"}</Text>
                            <Text style={styles.promptAnswer}>{p.answer || p.text || ""}</Text>
                        </View>
                    ))}
                </>
            )}

            <View style={{ height: 40 }} />
        </View>
    );
}


// --- Sub Components ---

const InfoRow = ({ icon, label, value }: { icon: any, label: string, value: string | null | undefined }) => {
    if (!value) return null; // Hide if empty
    return (
        <View style={styles.row}>
            <View style={styles.rowLeft}>
                <Ionicons name={icon} size={20} color={COLORS.secondaryText} style={{ marginRight: SPACING.md, width: 20 }} />
                <Text style={styles.rowLabel}>{label}</Text>
            </View>
            <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{value}</Text>
            </View>
        </View>
    );
};

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
                <Text style={[styles.rowValue, isMissing && styles.placeholderValue]}>{displayValue}</Text>
            </View>
        </View>
    );
};

const ChipGroup = ({ items, emptyLabel }: { items: string[] | undefined, emptyLabel?: string }) => {
    if (!items || items.length === 0) {
        if (!emptyLabel) return null;
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
    container: { paddingBottom: 20 },
    headerSection: { paddingHorizontal: 16, marginBottom: 16, marginTop: 16 },
    nameText: { ...TYPOGRAPHY.h1, color: COLORS.primaryText, fontSize: 24 },

    // Section Headers
    sectionTitle: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText, marginLeft: 16, marginTop: 24, marginBottom: 8 },
    sectionHeaderClickable: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingLeft: 16, marginTop: 24, marginBottom: 8, paddingRight: 4
    },
    sectionTitleClickable: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText },

    // Photos
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: GAP },
    photoSlot: { borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: COLORS.surface, position: 'relative' },
    photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    emptySlot: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },
    mainBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
    mainBadgeText: { color: 'white', fontSize: 10, fontWeight: '600' },

    // Bio & Cards
    card: { marginHorizontal: 16, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg },
    bioText: { ...TYPOGRAPHY.bodyBase, color: COLORS.primaryText },
    placeholderText: { ...TYPOGRAPHY.bodyBase, color: COLORS.secondaryText, fontStyle: 'italic' },

    // Info Rows
    infoList: { marginTop: 4 },
    row: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: COLORS.border // Optional separator
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center' },
    rowLabel: { fontSize: 16, color: COLORS.secondaryText },
    rowRight: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
    rowValue: { fontSize: 16, color: COLORS.primaryText, textAlign: 'right', flexWrap: 'wrap' },
    placeholderValue: { color: COLORS.secondaryText, fontStyle: 'italic' },

    // Chips
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.primary
    },
    chipText: { fontSize: 14, color: COLORS.primaryText, fontWeight: '500' },

    // Prompts
    promptCard: {
        marginHorizontal: 16, marginTop: 8, padding: 16,
        backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border
    },
    promptQuestion: { fontSize: 14, color: COLORS.secondaryText, marginBottom: 4 },
    promptAnswer: { fontSize: 16, color: COLORS.primaryText, fontWeight: '500' }
});
