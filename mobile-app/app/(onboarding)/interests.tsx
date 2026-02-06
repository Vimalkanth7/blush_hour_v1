import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

const INTERESTS = [
    "Photography", "Shopping", "Karaoke", "Yoga", "Cooking",
    "Tennis", "Run", "Swimming", "Art", "Traveling",
    "Extreme Sports", "Music", "Drink", "Video Games"
];

export default function InterestsScreen() {
    const router = useRouter();
    const { updateData } = useRegistration();
    const [selected, setSelected] = useState<string[]>([]);

    const toggleInterest = (interest: string) => {
        if (selected.includes(interest)) {
            setSelected(selected.filter(i => i !== interest));
        } else {
            if (selected.length < 5) {
                setSelected([...selected, interest]);
            }
        }
    };

    const handleNext = () => {
        updateData({ interests: selected });
        router.push('/(onboarding)/values');
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>Your interests</Text>
            <Text style={styles.subtitle}>Pick up to 5 things you love.</Text>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.cloud}>
                {INTERESTS.map((int) => {
                    const isSelected = selected.includes(int);
                    return (
                        <TouchableOpacity
                            key={int}
                            style={[styles.pill, isSelected && styles.selectedPill]}
                            onPress={() => toggleInterest(int)}
                        >
                            <Text style={[styles.pillText, isSelected && styles.selectedPillText]}>{int}</Text>
                        </TouchableOpacity>
                    )
                })}
            </ScrollView>

            <TouchableOpacity
                style={[styles.nextButton, { opacity: selected.length >= 3 ? 1 : 0.5 }]}
                onPress={handleNext}
                disabled={selected.length < 3}
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
        marginBottom: SPACING.sm
    },
    subtitle: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        marginBottom: SPACING.section
    },
    cloud: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm
    },
    pill: {
        paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface
    },
    selectedPill: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface
    },
    pillText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        fontWeight: '500'
    },
    selectedPillText: {
        color: COLORS.primaryText,
        fontWeight: '700'
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
