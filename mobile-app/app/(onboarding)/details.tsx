import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

// Simple Single Choice Component
const OptionSelector = ({ label, options, value, onChange }: any) => (
    <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {options.map((opt: string) => (
                <TouchableOpacity
                    key={opt}
                    style={[styles.chip, value === opt && styles.selectedChip]}
                    onPress={() => onChange(opt)}
                >
                    <Text style={[styles.chipText, value === opt && styles.selectedChipText]}>{opt}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
);

export default function DetailsScreen() {
    const router = useRouter();
    const { updateData } = useRegistration();

    const [height, setHeight] = useState('');
    const [education, setEducation] = useState(''); // Added
    const [exercise, setExercise] = useState('');
    const [drinking, setDrinking] = useState('');
    const [smoking, setSmoking] = useState('');
    const [kids, setKids] = useState('');

    const handleNext = () => {
        updateData({ height, exercise, education, drinking, smoking, kids });
        router.push('/(onboarding)/interests');
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>More about you</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Height (cm)</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="e.g. 175"
                        placeholderTextColor={COLORS.disabledText}
                        value={height}
                        onChangeText={setHeight}
                    />
                </View>

                <OptionSelector
                    label="Education"
                    options={['High School', 'Undergrad', 'Postgrad', 'Bootcamper']}
                    value={education}
                    onChange={setEducation}
                />

                <OptionSelector
                    label="Exercise"
                    options={['Active', 'Sometimes', 'Never']}
                    value={exercise}
                    onChange={setExercise}
                />

                <OptionSelector
                    label="Drinking"
                    options={['Socially', 'Never', 'Often']}
                    value={drinking}
                    onChange={setDrinking}
                />

                <OptionSelector
                    label="Smoking"
                    options={['Socially', 'Never', 'Chain']}
                    value={smoking}
                    onChange={setSmoking}
                />

                <OptionSelector
                    label="Kids"
                    options={['Have them', 'Want them', 'No thanks']}
                    value={kids}
                    onChange={setKids}
                />

                <View style={{ height: 100 }} />
            </ScrollView>

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
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
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.section
    },
    inputGroup: {
        marginBottom: SPACING.xxl
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.secondaryText,
        marginBottom: SPACING.sm
    },
    input: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        fontSize: 18,
        paddingVertical: SPACING.sm,
        color: COLORS.primaryText,
        fontFamily: TYPOGRAPHY.fontFamily
    },
    selectorContainer: {
        marginBottom: SPACING.xl
    },
    selectorLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.secondaryText,
        marginBottom: SPACING.md
    },
    chip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: SPACING.sm,
        backgroundColor: COLORS.surface
    },
    selectedChip: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface
    },
    chipText: {
        fontSize: 14,
        color: COLORS.secondaryText
    },
    selectedChipText: {
        color: COLORS.primaryText,
        fontWeight: '600'
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
