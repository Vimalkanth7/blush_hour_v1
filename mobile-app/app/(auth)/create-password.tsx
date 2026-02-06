import React, { useState } from 'react';
import { API_BASE_URL } from '../../constants/Api';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../constants/Theme';
// ... imports logic remains identical
// Robust URL selection via helper
const API_URL = `${API_BASE_URL}/api/auth/register`;

export default function CreatePasswordScreen() {
    const router = useRouter();
    const { phone } = useLocalSearchParams<{ phone: string }>();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { updateData } = useRegistration();
    // const { signIn } = useAuth(); // Auto-login removed per Requirement 2

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/phone-login');
        }
    };

    const handleRegister = async () => {
        const cleanPhone = phone ? phone.replace(/\s+/g, '').replace(/-/g, '') : '';
        console.log("Attempting Register:", API_URL, cleanPhone);

        if (password.length < 8) {
            Alert.alert("Weak Password", "Password must be at least 8 characters.");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: cleanPhone,
                    password: password
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);

                    // Handle Existing User (Conflict)
                    if (response.status === 409) {
                        // Direct navigation, no blocking alert
                        console.log("Account exists (409), redirecting to login...");
                        router.replace({
                            pathname: '/login',
                            params: { prefillPhone: cleanPhone }
                        });
                        return;
                    }

                    // Handle Validation Error
                    if (response.status === 400) {
                        const msg = errorJson.detail || "Invalid input.";
                        Alert.alert("Registration Failed", msg);
                    } else {
                        Alert.alert("Registration Failed", errorJson.detail || "Could not create account");
                    }
                } catch (e) {
                    console.error("Non-JSON Error Response:", errorText);
                    Alert.alert("Server Error", "The server returned an unexpected error. Please check logs.");
                }
                return;
            }

            // Success (Logic: Valid payload -> DB insert -> token)
            updateData({ phoneNumber: cleanPhone });

            // Direct navigation on success (no Alert)
            router.replace({
                pathname: '/login',
                params: { prefillPhone: cleanPhone }
            });

        } catch (error) {
            console.error(error);
            Alert.alert("Error", `Could not connect to server. ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
            </TouchableOpacity>

            <Text style={styles.title}>Create a password</Text>
            <Text style={styles.subtitle}>Secure your account with a strong password.</Text>

            <View style={styles.inputGroup}>
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        placeholder="Minimum 8 characters"
                        placeholderTextColor={COLORS.disabledText}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        autoFocus
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color={COLORS.secondaryText} />
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                style={[styles.nextButton, { opacity: password.length >= 8 ? 1 : 0.5 }]}
                onPress={handleRegister}
                disabled={password.length < 8 || isLoading}
            >
                {isLoading ? (
                    <ActivityIndicator color={COLORS.brandBase} />
                ) : (
                    <Ionicons name="arrow-forward" size={24} color={COLORS.brandBase} />
                )}
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
        marginBottom: SPACING.sm
    },
    subtitle: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        marginBottom: SPACING.section
    },
    inputGroup: {
        marginBottom: SPACING.xxl
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border
    },
    passwordInput: {
        flex: 1,
        fontSize: 18,
        paddingVertical: SPACING.sm,
        color: COLORS.primaryText,
        fontFamily: TYPOGRAPHY.fontFamily
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
