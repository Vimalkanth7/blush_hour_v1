import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';
// ... imports logic remains identical
// ... imports logic remains identical

const BirthdayScreen = () => {
    const router = useRouter();
    const { updateData } = useRegistration();

    // State
    const [date, setDate] = useState(new Date(2000, 0, 1));
    const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

    // Web specific state
    const [day, setDay] = useState('1');
    const [month, setMonth] = useState('1');
    const [year, setYear] = useState('2000');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const calculateAge = (dob: Date) => {
        const diff_ms = Date.now() - dob.getTime();
        const age_dt = new Date(diff_ms);
        return Math.abs(age_dt.getUTCFullYear() - 1970);
    };

    const handleNext = () => {
        let finalDate = date;

        if (Platform.OS === 'web') {
            const d = parseInt(day);
            const m = parseInt(month) - 1; // 0-indexed
            const y = parseInt(year);
            finalDate = new Date(y, m, d);

            // Basic validation
            if (isNaN(finalDate.getTime()) || d > 31 || m > 11 || y < 1900 || y > new Date().getFullYear()) {
                setErrorMsg("Please enter a valid date.");
                return;
            }
        }

        const age = calculateAge(finalDate);
        if (age < 18) {
            const msg = "You must be 18+ to use Blush Hour.";
            if (Platform.OS === 'web') setErrorMsg(msg);
            else Alert.alert("Age Restriction", msg);
            return;
        }

        // Proceed
        setErrorMsg(null);

        // On web we skip the confirmation alert for smoother flow, or we could show a non-blocking modal. 
        // For now, let's respect the "Do not block with native Alerts on web" rule strictly.
        if (Platform.OS === 'web') {
            updateData({ birthday: finalDate });
            router.push('/(onboarding)/gender');
        } else {
            Alert.alert(
                `You're ${age}`,
                "Make sure this is correct as you can't change it later.",
                [
                    { text: "Edit", style: "cancel" },
                    {
                        text: "Confirm",
                        onPress: () => {
                            updateData({ birthday: finalDate });
                            router.push('/(onboarding)/gender');
                        }
                    }
                ]
            );
        }
    };

    const handleBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/name'); // Fallback
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>When's your birthday?</Text>

            {/* Platform Specific Input */}
            {Platform.OS === 'web' ? (
                <View style={styles.webInputContainer}>
                    <TextInput
                        style={styles.webInput}
                        placeholder="DD"
                        placeholderTextColor={COLORS.disabledText}
                        value={day}
                        onChangeText={setDay}
                        keyboardType="numeric"
                        maxLength={2}
                    />
                    <TextInput
                        style={styles.webInput}
                        placeholder="MM"
                        placeholderTextColor={COLORS.disabledText}
                        value={month}
                        onChangeText={setMonth}
                        keyboardType="numeric"
                        maxLength={2}
                    />
                    <TextInput
                        style={styles.webInput}
                        placeholder="YYYY"
                        placeholderTextColor={COLORS.disabledText}
                        value={year}
                        onChangeText={setYear}
                        keyboardType="numeric"
                        maxLength={4}
                    />
                </View>
            ) : (
                <>
                    {Platform.OS === 'android' && (
                        <TouchableOpacity onPress={() => setShowPicker(true)} style={styles.androidPicker}>
                            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                    )}
                    {(showPicker || Platform.OS === 'ios') && (
                        <View style={styles.pickerContainer}>
                            <DateTimePicker
                                value={date}
                                mode="date"
                                display="spinner"
                                onChange={(event, selectedDate) => {
                                    if (Platform.OS === 'android') setShowPicker(false);
                                    if (selectedDate) setDate(selectedDate);
                                }}
                            />
                        </View>
                    )}
                </>
            )}

            <Text style={styles.subtitle}>Your profile shows your age, not your birthday.</Text>

            {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                <Ionicons name="arrow-forward" size={24} color={COLORS.brandBase} />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default BirthdayScreen;

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
        marginBottom: SPACING.xl
    },
    subtitle: {
        marginTop: SPACING.xl,
        color: COLORS.secondaryText,
        ...TYPOGRAPHY.bodyBase
    },
    androidPicker: {
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
    },
    dateText: {
        fontSize: 18,
        color: COLORS.primaryText,
        fontFamily: TYPOGRAPHY.fontFamily
    },
    pickerContainer: { alignItems: 'center', justifyContent: 'center' },
    nextButton: {
        position: 'absolute', bottom: 40, right: 24,
        width: 56, height: 56,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.small
    },
    webInputContainer: { flexDirection: 'row', gap: SPACING.md },
    webInput: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        fontSize: 18,
        padding: SPACING.sm,
        width: 80,
        textAlign: 'center',
        color: COLORS.primaryText,
        fontFamily: TYPOGRAPHY.fontFamily
    },
    errorText: {
        color: COLORS.destructive,
        marginTop: SPACING.lg,
        ...TYPOGRAPHY.bodyBase
    }
});
