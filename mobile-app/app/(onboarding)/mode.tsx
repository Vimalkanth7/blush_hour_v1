import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

export default function ModeScreen() {
    const router = useRouter();
    const { updateData } = useRegistration();
    const [mode, setMode] = useState<'Date' | 'BFF'>('Date');

    const handleNext = () => {
        updateData({ mode });
        router.push('/(onboarding)/intentions');
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>Choose a mode</Text>

            <TouchableOpacity
                style={[styles.card, mode === 'Date' && styles.activeCard]}
                onPress={() => setMode('Date')}
            >
                <View style={{ backgroundColor: COLORS.primary, padding: 10, borderRadius: 20, alignSelf: 'flex-start' }}>
                    <Ionicons name="heart" size={24} color="white" />
                </View>
                <Text style={styles.cardTitle}>Date</Text>
                <Text style={styles.cardDesc}>Find a relationship, casual, or in-between.</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.card, mode === 'BFF' && styles.activeCard]}
                onPress={() => setMode('BFF')}
            >
                <View style={{ backgroundColor: '#00C7D1', padding: 10, borderRadius: 20, alignSelf: 'flex-start' }}>
                    <Ionicons name="people" size={24} color="white" />
                </View>
                <Text style={styles.cardTitle}>BFF</Text>
                <Text style={styles.cardDesc}>Make new friends.</Text>
            </TouchableOpacity>

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
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        marginBottom: SPACING.section
    },
    card: {
        width: '45%',
        aspectRatio: 0.8,
        borderRadius: RADIUS.lg,
        borderWidth: 2,
        borderColor: COLORS.border,
        backgroundColor: COLORS.surface,
        justifyContent: 'center', alignItems: 'center',
        padding: SPACING.md
    },
    activeCard: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.surface
    },
    emoji: { fontSize: 48, marginBottom: SPACING.md },
    cardTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.xs
    },
    cardDesc: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
        textAlign: 'center'
    },
    nextButton: {
        position: 'absolute',
        bottom: 40, right: 24,
        width: 56, height: 56,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.small
    }
});
