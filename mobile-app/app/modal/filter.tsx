import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import * as Haptics from 'expo-haptics';

export default function FilterModal() {
    const router = useRouter();

    // State
    const [ageRange, setAgeRange] = useState([21, 35]);
    const [distance, setDistance] = useState([25]); // Single slider usually
    const [isVerified, setIsVerified] = useState(false);
    const [hasBio, setHasBio] = useState(true);

    const handleApply = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
    };

    const handleClear = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAgeRange([18, 99]);
        setDistance([100]);
        setIsVerified(false);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color={COLORS.primaryText} />
                </TouchableOpacity>
                <Text style={styles.title}>Filters</Text>
                <TouchableOpacity onPress={handleClear}>
                    <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Age Range */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Age Range</Text>
                        <Text style={styles.valueText}>{ageRange[0]} - {ageRange[1]}</Text>
                    </View>
                    <View style={styles.sliderContainer}>
                        <MultiSlider
                            values={[ageRange[0], ageRange[1]]}
                            sliderLength={320}
                            onValuesChange={(values) => setAgeRange(values)}
                            min={18}
                            max={60}
                            step={1}
                            allowOverlap={false}
                            snapped
                            selectedStyle={{ backgroundColor: COLORS.primary }}
                            markerStyle={{ backgroundColor: COLORS.primary, height: 24, width: 24 }}
                        />
                    </View>
                </View>

                {/* Distance */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Distance (km)</Text>
                        <Text style={styles.valueText}>{distance[0]}km</Text>
                    </View>
                    <View style={styles.sliderContainer}>
                        <MultiSlider
                            values={[distance[0]]}
                            sliderLength={320}
                            onValuesChange={(values) => setDistance(values)}
                            min={1}
                            max={160}
                            step={1}
                            selectedStyle={{ backgroundColor: COLORS.primary }}
                            markerStyle={{ backgroundColor: COLORS.primary, height: 24, width: 24 }}
                        />
                    </View>
                </View>

                {/* Toggles */}
                <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Verified profiles only</Text>
                    <Switch
                        value={isVerified}
                        onValueChange={setIsVerified}
                        trackColor={{ false: COLORS.disabled, true: COLORS.primary }}
                    />
                </View>

                <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>Has Bio</Text>
                    <Switch
                        value={hasBio}
                        onValueChange={setHasBio}
                        trackColor={{ false: COLORS.disabled, true: COLORS.primary }}
                    />
                </View>

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: SPACING.screen, borderBottomWidth: 1, borderBottomColor: COLORS.border
    },
    title: { ...TYPOGRAPHY.h2, fontSize: 18, color: COLORS.primaryText },
    clearText: { color: COLORS.secondaryText, fontWeight: '600' },
    content: { padding: SPACING.xxl },
    section: { marginBottom: SPACING.section },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.lg },
    sectionTitle: { ...TYPOGRAPHY.h2, fontSize: 16, color: COLORS.primaryText },
    valueText: { fontSize: 16, fontWeight: '600', color: COLORS.secondaryText },
    sliderContainer: { alignItems: 'center' },
    toggleRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: SPACING.xxl, paddingVertical: SPACING.sm
    },
    toggleLabel: { fontSize: 16, fontWeight: '500', color: COLORS.primaryText },
    footer: {
        padding: SPACING.xxl, borderTopWidth: 1, borderTopColor: COLORS.border,
        paddingBottom: 40
    },
    applyButton: {
        backgroundColor: COLORS.primary, padding: 18, borderRadius: RADIUS.pill,
        alignItems: 'center',
        ...SHADOWS.card
    },
    applyButtonText: { fontWeight: '700', fontSize: 16, color: COLORS.primaryText }
});
