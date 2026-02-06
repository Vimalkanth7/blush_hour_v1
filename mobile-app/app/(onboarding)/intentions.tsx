import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

const INTENTIONS = [
    "Long-term relationship",
    "Life partner",
    "Fun, casual dates",
    "Intimacy without commitment",
    "Marriage",
    "Ethical non-monogamy"
];

export default function IntentionsScreen() {
    const router = useRouter();
    const { updateData } = useRegistration();
    const [selected, setSelected] = useState<string | null>(null);

    const handleNext = () => {
        if (selected) {
            updateData({ intention: selected });
            router.push('/(onboarding)/details');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>What are you looking for?</Text>
            <Text style={styles.subtitle}>We'll help you find people with similar goals.</Text>

            <View style={styles.list}>
                {INTENTIONS.map((item) => (
                    <TouchableOpacity
                        key={item}
                        style={[styles.option, selected === item && styles.selectedOption]}
                        onPress={() => setSelected(item)}
                    >
                        <Text style={[styles.optionText, selected === item && styles.selectedOptionText]}>{item}</Text>
                        {selected === item && <Ionicons name="checkmark" size={20} color={COLORS.primaryText} />}
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.nextButton, { opacity: selected ? 1 : 0.5 }]}
                onPress={handleNext}
                disabled={!selected}
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
    list: { gap: SPACING.md },
    option: {
        padding: SPACING.lg,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.background
    },
    selectedOption: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface
    },
    optionText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.secondaryText,
        fontWeight: '500'
    },
    selectedOptionText: {
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
