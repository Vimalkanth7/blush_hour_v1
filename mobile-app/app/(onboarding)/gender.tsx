import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

const GENDER_OPTIONS = ['Woman', 'Man', 'Nonbinary'];

export default function GenderScreen() {
    const router = useRouter();
    const { updateData } = useRegistration();
    const [selectedGender, setSelectedGender] = useState('');
    const [showOnProfile, setShowOnProfile] = useState(true);
    const [interestedIn, setInterestedIn] = useState('');

    const handleNext = () => {
        updateData({ gender: selectedGender, showGender: showOnProfile, datingPreference: interestedIn });
        router.push('/(onboarding)/mode');
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>Basic Info</Text>

            <Text style={styles.label}>What's your gender?</Text>
            <View style={styles.options}>
                {GENDER_OPTIONS.map((gender) => (
                    <TouchableOpacity
                        key={gender}
                        style={[styles.option, selectedGender === gender && styles.activeOption]}
                        onPress={() => setSelectedGender(gender)}
                    >
                        <Text style={[styles.optionText, selectedGender === gender && styles.selectedOptionText]}>
                            {gender}
                        </Text>
                        {selectedGender === gender && <Ionicons name="checkmark" size={20} color={COLORS.primaryText} />}
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.toggleRow}>
                <Text style={styles.toggleText}>Show my gender on my profile</Text>
                <Switch
                    value={showOnProfile}
                    onValueChange={setShowOnProfile}
                    trackColor={{ false: COLORS.disabled, true: COLORS.primary }}
                    thumbColor={'#f4f3f4'}
                />
            </View>

            <View style={styles.divider} />

            <Text style={styles.label}>Who would you like to meet?</Text>
            <View style={styles.options}>
                {['Men', 'Women', 'Everyone'].map((opt) => (
                    <TouchableOpacity
                        key={opt}
                        style={[styles.option, interestedIn === opt && styles.activeOption]}
                        onPress={() => setInterestedIn(opt)}
                    >
                        <Text style={[styles.optionText, interestedIn === opt && styles.selectedOptionText]}>
                            {opt}
                        </Text>
                        {interestedIn === opt && <Ionicons name="checkmark" size={20} color={COLORS.primaryText} />}
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.nextButton, { opacity: (selectedGender && interestedIn) ? 1 : 0.5 }]}
                onPress={handleNext}
                disabled={!selectedGender || !interestedIn}
            >
                <Ionicons name="arrow-forward" size={24} color={COLORS.brandBase} />
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
        marginBottom: SPACING.section
    },
    options: { gap: SPACING.md },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.lg,
        borderRadius: RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.surface
    },
    activeOption: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface
    },
    optionText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.primaryText
    },
    sectionTitle: {
        ...TYPOGRAPHY.h2,
        marginTop: SPACING.lg,
        marginBottom: SPACING.md,
        color: COLORS.primaryText
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.section
    },
    selectedOptionText: {
        fontWeight: '700',
        color: COLORS.primaryText
    },
    label: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: SPACING.lg,
        color: COLORS.primaryText
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.xl
    },
    toggleText: {
        fontSize: 16,
        color: COLORS.secondaryText
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
