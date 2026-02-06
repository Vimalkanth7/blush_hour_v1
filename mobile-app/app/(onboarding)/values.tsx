import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

const VALUES_LIST = ["Kindness", "Loyalty", "Empathy", "Ambition", "Humor", "Growth"];
const CAUSES_LIST = ["Human Rights", "Environment", "Feminism", "BLM", "LGBTQ+ Rights", "Mental Health"];
const RELIGION_LIST = ["Agnostic", "Atheist", "Christian", "Hindu", "Muslim", "Jewish", "Spiritual", "Other"];
const POLITICS_LIST = ["Liberal", "Moderate", "Conservative", "Apolitical", "Leftist"];

const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
);

const ChipGroup = ({ items, selected, onSelect, multi = false }: any) => (
    <View style={styles.chipContainer}>
        {items.map((item: string) => {
            const isSelected = multi ? selected.includes(item) : selected === item;
            return (
                <TouchableOpacity
                    key={item}
                    style={[styles.chip, isSelected && styles.selectedChip]}
                    onPress={() => onSelect(item)}
                >
                    <Text style={[styles.chipText, isSelected && styles.selectedChipText]}>{item}</Text>
                </TouchableOpacity>
            );
        })}
    </View>
);

export default function ValuesScreen() {
    const router = useRouter();
    const { updateData } = useRegistration();

    const [values, setValues] = useState<string[]>([]);
    const [causes, setCauses] = useState<string[]>([]);
    const [religion, setReligion] = useState<string | null>(null);
    const [politics, setPolitics] = useState<string | null>(null);

    const toggleMulti = (list: string[], item: string, setList: any) => {
        if (list.includes(item)) setList(list.filter(i => i !== item));
        else setList([...list, item]);
    };

    const handleNext = () => {
        updateData({ values, causes, religion: religion || '', politics: politics || '' });
        router.push('/(onboarding)/prompts');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNext}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Values & Causes</Text>
                <Text style={styles.subtitle}>What matters to you?</Text>

                <SectionHeader title="My Top Values" />
                <ChipGroup
                    items={VALUES_LIST}
                    selected={values}
                    onSelect={(i: string) => toggleMulti(values, i, setValues)}
                    multi
                />

                <SectionHeader title="Causes I Care About" />
                <ChipGroup
                    items={CAUSES_LIST}
                    selected={causes}
                    onSelect={(i: string) => toggleMulti(causes, i, setCauses)}
                    multi
                />

                <SectionHeader title="Religion" />
                <ChipGroup
                    items={RELIGION_LIST}
                    selected={religion}
                    onSelect={setReligion}
                />

                <SectionHeader title="Politics" />
                <ChipGroup
                    items={POLITICS_LIST}
                    selected={politics}
                    onSelect={setPolitics}
                />

                <View style={{ height: 80 }} />
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
        backgroundColor: COLORS.background
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.screen,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.sm
    },
    skipText: {
        fontSize: 16,
        color: COLORS.secondaryText,
        fontWeight: '600'
    },
    scrollContent: {
        padding: SPACING.screen,
        paddingTop: SPACING.sm
    },
    title: {
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        marginBottom: SPACING.xs
    },
    subtitle: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        marginBottom: SPACING.section
    },
    sectionTitle: {
        ...TYPOGRAPHY.h2,
        marginTop: SPACING.lg,
        marginBottom: SPACING.sm,
        color: COLORS.primaryText
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm
    },
    chip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: COLORS.border,
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
