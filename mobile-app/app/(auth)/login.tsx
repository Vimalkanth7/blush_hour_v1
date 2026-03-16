import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, isApiRequestError, otpStart } from '../../constants/Api';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

type StatusType = 'error' | 'info';

const normalizePrefillPhone = (value: string | undefined): string => {
    if (!value) return '';

    const trimmed = value.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('+')) {
        return `+${trimmed.slice(1).replace(/\D/g, '')}`;
    }

    const digits = trimmed.replace(/\D/g, '');
    return digits ? `+${digits}` : '';
};

const sanitizePhoneInput = (value: string): string => {
    if (!value) return '';

    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, '');

    if (!digits) {
        return trimmed.startsWith('+') ? '+' : '';
    }

    return `+${digits}`;
};

const mapOtpStartError = (error: unknown): string => {
    if (!isApiRequestError(error)) {
        return error instanceof Error ? error.message : 'Unable to send OTP.';
    }

    const detail = error.detail || 'Unable to send OTP.';
    const lowerDetail = detail.toLowerCase();

    if (error.status === 0) {
        return 'Network error. Check your connection and try again.';
    }
    if (error.status === 429) {
        return 'Too many requests. Please wait before trying again.';
    }
    if (error.status === 503 && (lowerDetail.includes('disabled') || lowerDetail.includes('not configured'))) {
        return 'OTP login is currently unavailable. Please try again later.';
    }
    if (error.status === 503) {
        return 'OTP service is temporarily unavailable. Please try again shortly.';
    }

    return detail;
};

export default function LoginScreen() {
    const router = useRouter();
    const { prefillPhone } = useLocalSearchParams<{ prefillPhone?: string }>();
    const [phone, setPhone] = useState(() => normalizePrefillPhone(prefillPhone));
    const [isLoading, setIsLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ text: string, type: StatusType } | null>(null);

    const isPhoneValid = useMemo(() => E164_REGEX.test(phone), [phone]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace('/welcome');
    };

    const handleSendOtp = async () => {
        if (!isPhoneValid) {
            setStatusMsg({ text: 'Enter a valid phone number in E.164 format (example: +14155550123).', type: 'error' });
            return;
        }

        setIsLoading(true);
        setStatusMsg(null);

        try {
            await otpStart(phone);
            router.push({
                pathname: '/otp-code',
                params: { phone },
            });
        } catch (error) {
            setStatusMsg({ text: mapOtpStartError(error), type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.debugContainer}>
                <Text style={styles.debugText}>API: {API_BASE_URL}</Text>
            </View>

            <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior="height">
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Log in with OTP</Text>
                    <Text style={styles.subtitle}>Enter your phone number in international format.</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <Input
                            placeholder="+14155550123"
                            keyboardType="phone-pad"
                            autoFocus={false}
                            autoCapitalize="none"
                            autoComplete="tel"
                            autoCorrect={false}
                            blurOnSubmit={false}
                            showSoftInputOnFocus
                            textContentType="telephoneNumber"
                            value={phone}
                            onChangeText={(value) => {
                                setPhone(sanitizePhoneInput(value));
                                if (statusMsg) setStatusMsg(null);
                            }}
                        />
                        {!!phone && !isPhoneValid && (
                            <Text style={styles.validationText}>Use E.164 format: + then country code and number</Text>
                        )}
                    </View>

                    {statusMsg && (
                        <View style={styles.toast}>
                            <Text style={styles.toastText}>{statusMsg.text}</Text>
                        </View>
                    )}

                    <Button
                        label="Send OTP"
                        onPress={handleSendOtp}
                        disabled={isLoading || !phone}
                        loading={isLoading}
                        style={styles.loginButton}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        padding: SPACING.screen
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    debugContainer: {
        position: 'absolute',
        top: 5,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10
    },
    debugText: {
        fontSize: 10,
        color: '#aaa',
        fontFamily: 'monospace'
    },
    backButton: {
        marginBottom: SPACING.display,
        marginTop: SPACING.sm
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
        marginBottom: SPACING.xl
    },
    label: {
        ...TYPOGRAPHY.bodyBase,
        fontWeight: '600',
        color: COLORS.secondaryText,
        marginBottom: SPACING.sm
    },
    validationText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.destructive,
        marginTop: SPACING.sm
    },
    loginButton: {
        marginTop: SPACING.section
    },
    toast: {
        padding: SPACING.md,
        borderRadius: RADIUS.sm,
        marginBottom: SPACING.md,
        backgroundColor: '#ffebee'
    },
    toastText: {
        fontWeight: '600',
        color: COLORS.primaryText
    }
});
