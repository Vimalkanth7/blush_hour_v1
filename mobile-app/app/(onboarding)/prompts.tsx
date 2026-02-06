import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';

const QUESTIONS = [
    "I'll know we vibe if...",
    "My simple pleasures...",
    "A non-negotiable...",
    "I'm known for..."
];

export default function PromptsScreen() {
    const router = useRouter();
    const { updateData } = useRegistration();

    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
    const [answer, setAnswer] = useState('');
    const [prompts, setPrompts] = useState<{ question: string, answer: string }[]>([]);

    const handleSavePrompt = () => {
        if (selectedQuestion && answer) {
            setPrompts([...prompts, { question: selectedQuestion, answer }]);
            setSelectedQuestion(null);
            setAnswer('');
        }
    };

    const handleNext = () => {
        updateData({ prompts });
        router.push('/(onboarding)/photos');
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>Make it pop</Text>
            <Text style={styles.subtitle}>Add at least 1 prompt.</Text>

            {/* List of Added Prompts */}
            {prompts.map((p, i) => (
                <View key={i} style={styles.addedPrompt}>
                    <Text style={styles.promptQ}>{p.question}</Text>
                    <Text style={styles.promptA}>{p.answer}</Text>
                </View>
            ))}

            {/* Prompt Selector */}
            {prompts.length < 3 && (
                <View style={styles.selector}>
                    <Text style={styles.selectorTitle}>Select a Prompt</Text>
                    {QUESTIONS.filter(q => !prompts.find(p => p.question === q)).map(q => (
                        <TouchableOpacity key={q} style={styles.questionRow} onPress={() => setSelectedQuestion(q)}>
                            <Text style={styles.questionText}>{q}</Text>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.disabledText} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Modal for Input */}
            <Modal visible={!!selectedQuestion} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Write your answer</Text>
                        <TouchableOpacity onPress={() => setSelectedQuestion(null)}>
                            <Ionicons name="close" size={24} color={COLORS.primaryText} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.modalQuestion}>{selectedQuestion}</Text>
                    <TextInput
                        style={styles.modalInput}
                        multiline
                        placeholder="Type here..."
                        placeholderTextColor={COLORS.disabledText}
                        maxLength={160}
                        value={answer}
                        onChangeText={setAnswer}
                        autoFocus
                    />
                    <Text style={styles.charCount}>{answer.length}/160</Text>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSavePrompt}>
                        <Text style={styles.saveButtonText}>Save Prompt</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            <TouchableOpacity
                style={[styles.nextButton, { opacity: prompts.length > 0 ? 1 : 0.5 }]}
                onPress={handleNext}
                disabled={prompts.length === 0}
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
    addedPrompt: {
        backgroundColor: COLORS.surface,
        padding: SPACING.md,
        borderRadius: RADIUS.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.primary
    },
    promptQ: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.secondaryText,
        marginBottom: SPACING.xs
    },
    promptA: {
        fontSize: 16,
        color: COLORS.primaryText
    },
    selector: {
        marginTop: SPACING.sm
    },
    selectorTitle: {
        ...TYPOGRAPHY.h2,
        marginBottom: SPACING.sm,
        color: COLORS.secondaryText
    },
    questionRow: {
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    questionText: {
        fontSize: 16,
        color: COLORS.primaryText
    },
    nextButton: {
        position: 'absolute', bottom: 40, right: 24,
        width: 56, height: 56,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.small
    },
    modalContainer: {
        flex: 1,
        padding: SPACING.screen,
        paddingTop: 60,
        backgroundColor: COLORS.background
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.section
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.primaryText
    },
    modalQuestion: {
        ...TYPOGRAPHY.display,
        fontSize: 24,
        marginBottom: SPACING.lg,
        color: COLORS.primaryText
    },
    modalInput: {
        fontSize: 18,
        minHeight: 100,
        textAlignVertical: 'top',
        color: COLORS.primaryText,
        fontFamily: TYPOGRAPHY.fontFamily
    },
    charCount: {
        textAlign: 'right',
        color: COLORS.disabledText,
        marginTop: SPACING.sm
    },
    saveButton: {
        backgroundColor: COLORS.primary,
        padding: SPACING.md,
        borderRadius: RADIUS.pill,
        alignItems: 'center',
        marginTop: SPACING.section
    },
    saveButtonText: {
        fontWeight: '700',
        fontSize: 16,
        color: COLORS.brandBase
    }
});
