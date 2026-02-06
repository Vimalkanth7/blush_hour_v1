import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';
import { Input } from '../../components/ui/Input';
// ... logic remains same
// ... imports logic remains same

export default function PhoneLoginScreen() {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const { updateData } = useRegistration();
    const handleNext = () => {
        if (phone.length < 10) return;

        // Save phone to context/local storage if needed
        updateData({ phoneNumber: phone });

        // Navigate to password creation
        router.push({
            pathname: '/(auth)/create-password',
            params: { phone }
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>What's your number?</Text>

            <Input
                placeholder="00000 00000"
                keyboardType="phone-pad"
                autoFocus
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                maxLength={10}
                leftSlot={(
                    <View style={styles.countryCode}>
                        <Text style={styles.countryText}>IN +91</Text>
                    </View>
                )}
            />

            {phone.length > 0 && phone.length < 10 && (
                <Text style={styles.errorText}>Please enter a valid 10-digit number</Text>
            )}

            <Text style={styles.note}>We'll send a text with a verification code. Message and data rates may apply.</Text>

            <TouchableOpacity
                style={[styles.nextButton, { opacity: phone.length >= 10 ? 1 : 0.5 }]}
                onPress={handleNext}
                disabled={phone.length < 10}
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
        marginBottom: SPACING.xl
    },
    title: {
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        marginBottom: 40
    },
    countryCode: {
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
        paddingRight: SPACING.md,
        marginRight: SPACING.md,
        justifyContent: 'center'
    },
    countryText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.primaryText
    },
    note: {
        marginTop: SPACING.xl,
        color: COLORS.secondaryText,
        lineHeight: 20
    },
    errorText: {
        color: COLORS.destructive,
        fontSize: 14,
        marginTop: SPACING.sm
    },
    nextButton: {
        position: 'absolute',
        bottom: 40, right: 24,
        width: 56, height: 56,
        borderRadius: RADIUS.pill, // 28 is confusing, usually half of height. pill is 30.
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        ...SHADOWS.small
    }
});
