import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { isApiRequestError, otpStart, otpVerify } from '../../constants/Api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, TYPOGRAPHY } from '../../constants/Theme';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const CODE_REGEX = /^\d{6}$/;
const RESEND_COOLDOWN_SECONDS = 30;

type StatusType = 'error' | 'success';

const sanitizeCodeInput = (value: string): string => value.replace(/\D/g, '').slice(0, 6);

const mapVerifyError = (error: unknown): string => {
    if (!isApiRequestError(error)) {
        return error instanceof Error ? error.message : 'Unable to verify OTP.';
    }

    const detail = error.detail || 'Unable to verify OTP.';
    const lowerDetail = detail.toLowerCase();

    if (error.status === 0) {
        return 'Network error. Check your connection and try again.';
    }
    if (error.status === 429) {
        return 'Too many attempts. Please wait before trying again.';
    }
    if (error.status === 503 && (lowerDetail.includes('disabled') || lowerDetail.includes('not configured'))) {
        return 'OTP login is currently unavailable. Please try again later.';
    }
    if (error.status === 503) {
        return 'OTP service is temporarily unavailable. Please try again shortly.';
    }
    if ((error.status === 400 || error.status === 401) && (lowerDetail.includes('invalid') || lowerDetail.includes('expired') || lowerDetail.includes('code'))) {
        return 'Invalid or expired OTP. Please try again.';
    }

    return detail;
};

const mapResendError = (error: unknown): string => {
    if (!isApiRequestError(error)) {
        return error instanceof Error ? error.message : 'Unable to resend OTP.';
    }

    const detail = error.detail || 'Unable to resend OTP.';
    const lowerDetail = detail.toLowerCase();

    if (error.status === 0) {
        return 'Network error. Check your connection and try again.';
    }
    if (error.status === 429) {
        return 'Too many resend requests. Please wait and try again.';
    }
    if (error.status === 503 && (lowerDetail.includes('disabled') || lowerDetail.includes('not configured'))) {
        return 'OTP login is currently unavailable. Please try again later.';
    }
    if (error.status === 503) {
        return 'OTP service is temporarily unavailable. Please try again shortly.';
    }

    return detail;
};

export default function OtpCodeScreen() {
    const router = useRouter();
    const { signIn } = useAuth();
    const { phone } = useLocalSearchParams<{ phone?: string }>();
    const normalizedPhone = typeof phone === 'string' ? phone : '';

    const [code, setCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(normalizedPhone ? RESEND_COOLDOWN_SECONDS : 0);
    const [statusMsg, setStatusMsg] = useState<{ text: string, type: StatusType } | null>(null);

    const canVerify = useMemo(() => CODE_REGEX.test(code) && !!normalizedPhone && !isVerifying, [code, normalizedPhone, isVerifying]);

    useEffect(() => {
        if (cooldownSeconds <= 0) return;

        const timer = setInterval(() => {
            setCooldownSeconds((current) => (current > 0 ? current - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldownSeconds]);

    useEffect(() => {
        if (!normalizedPhone) {
            setStatusMsg({ text: 'Phone number is missing. Please enter your phone again.', type: 'error' });
        }
    }, [normalizedPhone]);

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace('/login');
    };

    const handleVerify = async () => {
        if (!normalizedPhone) {
            router.replace('/login');
            return;
        }

        if (!CODE_REGEX.test(code)) {
            setStatusMsg({ text: 'Enter a valid 6-digit OTP code.', type: 'error' });
            return;
        }

        setIsVerifying(true);
        setStatusMsg(null);

        try {
            const data = await otpVerify(normalizedPhone, code);
            if (!data.access_token) {
                setStatusMsg({ text: 'No access token returned. Please try again.', type: 'error' });
                return;
            }

            await signIn(data.access_token);
        } catch (error) {
            setStatusMsg({ text: mapVerifyError(error), type: 'error' });
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (!normalizedPhone || cooldownSeconds > 0 || isResending) {
            return;
        }

        setIsResending(true);
        setStatusMsg(null);

        try {
            await otpStart(normalizedPhone);
            setCode('');
            setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
            setStatusMsg({ text: 'A new OTP has been sent.', type: 'success' });
        } catch (error) {
            setStatusMsg({ text: mapResendError(error), type: 'error' });
        } finally {
            setIsResending(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primaryText} />
                </TouchableOpacity>

                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>
                    {normalizedPhone
                        ? `We sent a 6-digit code to ${normalizedPhone}.`
                        : 'Enter your 6-digit verification code.'}
                </Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Verification Code</Text>
                    <Input
                        placeholder="000000"
                        keyboardType="number-pad"
                        autoFocus
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={code}
                        onChangeText={(value) => {
                            setCode(sanitizeCodeInput(value));
                            if (statusMsg) setStatusMsg(null);
                        }}
                        maxLength={6}
                    />
                    {!!code && !CODE_REGEX.test(code) && (
                        <Text style={styles.validationText}>Code must be exactly 6 digits</Text>
                    )}
                </View>

                {statusMsg && (
                    <View style={[styles.toast, statusMsg.type === 'success' ? styles.toastSuccess : styles.toastError]}>
                        <Text style={styles.toastText}>{statusMsg.text}</Text>
                    </View>
                )}

                <Button
                    label="Verify"
                    onPress={handleVerify}
                    disabled={!canVerify}
                    loading={isVerifying}
                    style={styles.verifyButton}
                />

                <View style={styles.resendRow}>
                    <TouchableOpacity
                        onPress={handleResend}
                        disabled={cooldownSeconds > 0 || isResending || !normalizedPhone}
                        style={styles.resendButton}
                    >
                        <Text style={[styles.resendText, (cooldownSeconds > 0 || isResending || !normalizedPhone) && styles.resendDisabled]}>
                            {isResending
                                ? 'Resending...'
                                : cooldownSeconds > 0
                                    ? `Resend in ${cooldownSeconds}s`
                                    : 'Resend OTP'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    onPress={() => router.replace('/login')}
                    style={styles.changePhoneButton}
                >
                    <Text style={styles.changePhoneText}>Change phone number</Text>
                </TouchableOpacity>
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
    toast: {
        padding: SPACING.md,
        borderRadius: RADIUS.sm,
        marginBottom: SPACING.md
    },
    toastError: {
        backgroundColor: '#ffebee'
    },
    toastSuccess: {
        backgroundColor: '#e8f5e9'
    },
    toastText: {
        fontWeight: '600',
        color: COLORS.primaryText
    },
    verifyButton: {
        marginTop: SPACING.section
    },
    resendRow: {
        marginTop: SPACING.md,
        alignItems: 'center'
    },
    resendButton: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md
    },
    resendText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.primary
    },
    resendDisabled: {
        color: COLORS.disabledText
    },
    changePhoneButton: {
        marginTop: SPACING.section,
        alignItems: 'center'
    },
    changePhoneText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText
    }
});
