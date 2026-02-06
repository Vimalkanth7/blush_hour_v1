import React, { useState } from 'react';
import { API_BASE_URL, handleApiError } from '../../constants/Api';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
// ... logic remains identical
// ... imports logic remains identical

export default function LoginScreen() {
    const router = useRouter();
    const { prefillPhone } = useLocalSearchParams<{ prefillPhone: string }>();
    const [phone, setPhone] = useState(prefillPhone || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);
    const { signIn, signOut } = useAuth();

    const handleLogin = async () => {
        if (!phone || !password) return;

        setIsLoading(true);
        setStatusMsg(null);
        try {
            // Normalize phone: remove all non-digits, extract last 10 chars
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length > 10) {
                cleanPhone = cleanPhone.slice(-10);
            }

            console.log("Attempting Login:", { phone_number: cleanPhone });

            // Using 'phone_number' and 'password' as strict JSON keys
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone_number: cleanPhone,
                    password: password
                })
            });

            if (await handleApiError(response, signOut)) {
                setIsLoading(false);
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.log("Login Error Response:", response.status, errorText);
                try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.detail || "Login failed");
                } catch (e) {
                    // If parsing fails, use the raw text or default
                    const msg = errorText && errorText.length < 100 ? errorText : "Login failed (Server Error)";
                    throw new Error(msg);
                }
            }

            const data = await response.json();
            // Expect { access_token: string, ... }
            if (data.access_token) {
                await signIn(data.access_token);
            } else {
                throw new Error("No access token returned");
            }

        } catch (error) {
            console.error("Login error:", error);
            setStatusMsg({
                text: error instanceof Error ? error.message : "Invalid phone or password",
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.debugContainer}>
                <Text style={styles.debugText}>API: {API_BASE_URL}</Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>

                <Text style={styles.title}>Welcome back</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <Input
                        placeholder="99999 99999"
                        keyboardType="phone-pad"
                        value={phone}
                        onChangeText={setPhone}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <Input
                        placeholder="Enter your password"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        rightSlot={(
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color={COLORS.secondaryText} />
                            </TouchableOpacity>
                        )}
                    />
                </View>

                {statusMsg && (
                    <View style={[styles.toast, statusMsg.type === 'error' ? styles.toastError : styles.toastSuccess]}>
                        <Text style={styles.toastText}>{statusMsg.text}</Text>
                    </View>
                )}

                <Button
                    label="Log In"
                    onPress={handleLogin}
                    disabled={!phone || !password || isLoading}
                    loading={isLoading}
                    style={styles.loginButton}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screen
    },
    debugContainer: {
        position: 'absolute', top: 5, left: 0, right: 0, alignItems: 'center', zIndex: 10
    },
    debugText: {
        fontSize: 10, color: '#aaa', fontFamily: 'monospace'
    },
    backButton: {
        marginBottom: SPACING.display,
        marginTop: SPACING.sm
    },
    title: {
        ...TYPOGRAPHY.display,
        color: COLORS.primaryText,
        marginBottom: SPACING.section
    },
    inputGroup: {
        marginBottom: SPACING.xxl
    },
    label: {
        ...TYPOGRAPHY.bodyBase,
        fontWeight: '600',
        color: COLORS.secondaryText,
        marginBottom: SPACING.sm
    },
    loginButton: {
        marginTop: SPACING.section
    },
    toast: {
        padding: SPACING.md,
        borderRadius: RADIUS.sm,
        marginBottom: SPACING.md,
        alignItems: 'center'
    },
    toastError: { backgroundColor: '#ffebee' }, // Could map to a lightened destructive token if available
    toastSuccess: { backgroundColor: '#e8f5e9' },
    toastText: {
        fontWeight: '600',
        color: COLORS.primaryText
    }
});
