import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, AppState, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    FadeIn,
} from 'react-native-reanimated';

import {
    API_BASE_URL,
    getChatNightStatus,
    isApiRequestError,
    type ChatNightSpendSource,
    type ChatNightStatusResponse,
} from '../../constants/Api';

type ScreenStatus = 'loading' | 'closed' | 'open' | 'searching' | 'gated';
type EntryBalanceState = 'free_available' | 'paid_fallback' | 'fully_exhausted';
type ProfileIssue = {
    message: string;
    needed: string;
    current: string;
    missing: string[];
};
type EntryMessage = {
    body: string;
    iconName: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
};

const formatCountLabel = (count: number, singular: string, plural: string) => {
    return `${count} ${count === 1 ? singular : plural}`;
};

const getEntryBalanceState = (
    freePassesRemaining: number,
    paidPassCredits: number,
    effectivePassesRemaining: number,
    nextSpendSource: ChatNightSpendSource | null,
): EntryBalanceState => {
    if (nextSpendSource === 'free_daily' || freePassesRemaining > 0) {
        return 'free_available';
    }

    if (nextSpendSource === 'paid_credit' || paidPassCredits > 0 || effectivePassesRemaining > 0) {
        return 'paid_fallback';
    }

    return 'fully_exhausted';
};

const getEntryMessage = (
    entryBalanceState: EntryBalanceState,
    freePassesRemaining: number,
    paidPassCredits: number,
    isOpen: boolean,
): EntryMessage => {
    if (entryBalanceState === 'free_available') {
        return {
            iconName: 'checkmark-circle-outline',
            title: 'Free daily pass available',
            body: `${isOpen
                ? `You still have ${formatCountLabel(freePassesRemaining, 'free daily pass', 'free daily passes')} ready right now.`
                : `You have ${formatCountLabel(freePassesRemaining, 'free daily pass', 'free daily passes')} ready for the next Chat Night session.`} Free daily passes are used first. Paid credits are spent only after your free daily passes run out.`,
        };
    }

    if (entryBalanceState === 'paid_fallback') {
        return {
            iconName: 'wallet-outline',
            title: 'Paid credits available',
            body: `Your free daily passes are exhausted for today, but you still have ${formatCountLabel(paidPassCredits, 'paid pass credit', 'paid pass credits')} available.${isOpen ? ' You can still enter Chat Night now.' : ''} Free daily passes are used first. Paid credits are spent only after your free daily passes run out.`,
        };
    }

    return {
        iconName: 'moon-outline',
        title: 'Out of passes',
        body: 'No Chat Night pass remains right now. Free daily passes reset later, and you can buy paid credits in Passes. Free daily passes are used first. Paid credits are spent only after your free daily passes run out.',
    };
};

export default function ChatNightScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [status, setStatus] = useState<ScreenStatus>('loading');
    const [chatNightStatus, setChatNightStatus] = useState<ChatNightStatusResponse | null>(null);
    const [nextSession, setNextSession] = useState('20:00');
    const [profileIssue, setProfileIssue] = useState<ProfileIssue | null>(null);
    const [enteringPool, setEnteringPool] = useState(false);

    const appState = useRef(AppState.currentState);
    const pollIdRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const freePassesRemaining = chatNightStatus?.passes_remaining_today ?? chatNightStatus?.passes_remaining ?? 0;
    const paidPassCredits = chatNightStatus?.paid_pass_credits ?? 0;
    const effectivePassesRemaining = chatNightStatus?.effective_passes_remaining ?? (freePassesRemaining + paidPassCredits);
    const nextSpendSource = chatNightStatus?.next_spend_source ?? null;
    const hasEffectiveEntitlement = (
        effectivePassesRemaining > 0
        || nextSpendSource === 'free_daily'
        || nextSpendSource === 'paid_credit'
    );
    const entryBalanceState = getEntryBalanceState(
        freePassesRemaining,
        paidPassCredits,
        effectivePassesRemaining,
        nextSpendSource,
    );
    const canEnterPool = hasEffectiveEntitlement;
    const entryMessage = getEntryMessage(
        entryBalanceState,
        freePassesRemaining,
        paidPassCredits,
        Boolean(chatNightStatus?.is_open),
    );

    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    useEffect(() => {
        if (status === 'open' && !enteringPool && canEnterPool) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                ),
                -1,
                true,
            );
        } else {
            scale.value = withTiming(1);
        }
    }, [canEnterPool, enteringPool, scale, status]);

    useEffect(() => {
        if (status === 'searching') {
            opacity.value = withRepeat(
                withSequence(
                    withTiming(0.6, { duration: 800 }),
                    withTiming(1, { duration: 800 }),
                ),
                -1,
                true,
            );
        } else {
            opacity.value = withTiming(1);
        }
    }, [opacity, status]);

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const animatedSearchStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const stopPolling = useCallback(() => {
        if (pollIdRef.current) {
            clearInterval(pollIdRef.current);
            pollIdRef.current = null;
        }
    }, []);

    const applyChatNightStatus = useCallback((
        data: ChatNightStatusResponse,
        preserveSearchingState = true,
    ) => {
        setChatNightStatus(data);

        if (data.status === 'gated') {
            setProfileIssue({
                message: data.detail || data.message || 'Profile completion required.',
                needed: 'Required Level',
                current: 'Your Level',
                missing: data.missing_fields || [],
            });
            setStatus('gated');
            return;
        }

        setProfileIssue(null);

        if (data.is_open) {
            if (!preserveSearchingState || status !== 'searching') {
                setStatus('open');
            }
            return;
        }

        setNextSession(data.next_start || '20:00');
        if (!preserveSearchingState || status !== 'searching') {
            setStatus('closed');
        }
    }, [status]);

    const checkStatus = useCallback(async (preserveSearchingState = true) => {
        if (!token) {
            return null;
        }

        try {
            const data = await getChatNightStatus(token);
            applyChatNightStatus(data, preserveSearchingState);
            return data;
        } catch (error) {
            if (
                isApiRequestError(error)
                && error.status === 400
                && error.detail.toLowerCase().includes('completion')
            ) {
                setProfileIssue({
                    message: error.detail,
                    needed: 'Required Level',
                    current: 'Your Level',
                    missing: [],
                });
                setStatus('gated');
                return null;
            }

            console.warn('[ChatNight] Status Check Failed', error);
            if (status !== 'closed' && status !== 'gated') {
                setStatus('closed');
            }
            return null;
        }
    }, [applyChatNightStatus, status, token]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            const previousAppState = appState.current;
            appState.current = nextAppState;

            if (
                previousAppState.match(/inactive|background/)
                && nextAppState === 'active'
            ) {
                void checkStatus(false);
            }
        });

        return () => subscription.remove();
    }, [checkStatus]);

    useFocusEffect(
        useCallback(() => {
            void checkStatus(false);
        }, [checkStatus]),
    );

    useEffect(() => {
        if (!token) {
            return;
        }

        void checkStatus();

        const statusInterval = setInterval(() => {
            if (appState.current.match(/inactive|background/)) {
                return;
            }

            if (status === 'closed') {
                void checkStatus();
            }
        }, 5000);

        return () => {
            clearInterval(statusInterval);
            stopPolling();
        };
    }, [checkStatus, status, stopPolling, token]);

    const handleOpenPasses = () => {
        router.push('/passes');
    };

    const handleEnterPool = async () => {
        if (!token || enteringPool) {
            return;
        }

        if (!canEnterPool) {
            handleOpenPasses();
            return;
        }

        setEnteringPool(true);
        setStatus('searching');

        try {
            const res = await fetch(`${API_BASE_URL}/api/chat-night/enter`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => null);
            console.log('[ChatNight] Enter response:', data);

            if (!res.ok) {
                const detail = typeof data?.detail === 'string'
                    ? data.detail
                    : 'Unable to join Chat Night right now.';

                if (res.status === 403 && detail.toLowerCase().includes('no chat night passes')) {
                    await checkStatus(false);
                    return;
                }

                await checkStatus(false);
                Alert.alert('Unable to enter', detail);
                return;
            }

            if (data?.status === 'match_found' && typeof data.room_id === 'string') {
                console.log('[ChatNight] Match found immediately -> roomId:', data.room_id);
                stopPolling();
                router.replace({
                    pathname: '/chat/talk-room',
                    params: { roomId: data.room_id },
                });
                setStatus('open');
                return;
            }

            if (data?.status === 'queued') {
                console.log('[ChatNight] queued -> polling my-room');
                startPolling();
                return;
            }

            if (typeof data?.room_id === 'string') {
                console.log('[ChatNight] Rejoining active room -> roomId:', data.room_id);
                stopPolling();
                router.replace({
                    pathname: '/chat/talk-room',
                    params: { roomId: data.room_id },
                });
                setStatus('open');
                return;
            }

            await checkStatus(false);
        } catch (error) {
            console.error('Enter error', error);
            Alert.alert('Error', 'Failed to join pool. Please check your connection.');
            setStatus('open');
        } finally {
            setEnteringPool(false);
        }
    };

    const startPolling = () => {
        stopPolling();

        const pid = setInterval(async () => {
            if (appState.current.match(/inactive|background/)) {
                return;
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/chat-night/my-room`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();

                if (data.state === 'active' || data.state === 'engaged') {
                    console.log('[ChatNight] my-room found -> roomId=', data.room_id);
                    stopPolling();
                    router.replace({
                        pathname: '/chat/talk-room',
                        params: { roomId: data.room_id },
                    });
                    setStatus('open');
                }
            } catch (error) {
                console.warn('[ChatNight] Polling error', error);
            }
        }, 2000);

        pollIdRef.current = pid;
    };

    const cancelSearch = async () => {
        stopPolling();
        console.log('[ChatNight] Cancelling search');

        try {
            await fetch(`${API_BASE_URL}/api/chat-night/leave`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch (error) {
            console.error('Leave error', error);
        }

        await checkStatus(false);
        setEnteringPool(false);
    };

    const renderEntryStatusCard = () => {
        const stateStyles = entryBalanceState === 'fully_exhausted'
            ? {
                accentColor: COLORS.destructive,
                cardStyle: styles.entryStateCardExhausted,
                iconStyle: styles.entryStateIconExhausted,
            }
            : entryBalanceState === 'paid_fallback'
                ? {
                    accentColor: COLORS.primary,
                    cardStyle: styles.entryStateCardPaid,
                    iconStyle: styles.entryStateIconPaid,
                }
                : {
                    accentColor: COLORS.success,
                    cardStyle: styles.entryStateCardFree,
                    iconStyle: styles.entryStateIconFree,
                };

        return (
            <Card style={[styles.entryStateCard, stateStyles.cardStyle]}>
                <View style={styles.entryStateHeader}>
                    <View style={[styles.entryStateIconWrap, stateStyles.iconStyle]}>
                        <Ionicons name={entryMessage.iconName} size={22} color={stateStyles.accentColor} />
                    </View>
                    <View style={styles.entryStateCopy}>
                        <Text style={styles.entryStateTitle}>{entryMessage.title}</Text>
                        <Text style={styles.entryStateBody}>{entryMessage.body}</Text>
                    </View>
                </View>

                {entryBalanceState === 'fully_exhausted' ? (
                    <Button
                        label="Open Passes"
                        onPress={handleOpenPasses}
                        variant="secondary"
                        style={styles.entryStateButton}
                    />
                ) : null}
            </Card>
        );
    };

    if (status === 'loading') {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Blush Hour</Text>
                    <Text style={styles.apiText}>API: {API_BASE_URL.replace('http://', '')}</Text>
                </View>

                <View style={styles.balanceGroup}>
                    <View style={[styles.balanceChip, freePassesRemaining > 0 ? styles.balanceChipActive : styles.balanceChipMuted]}>
                        <Text style={styles.balanceChipLabel}>Free</Text>
                        <Text style={styles.balanceChipValue}>{freePassesRemaining}</Text>
                    </View>
                    <View style={[styles.balanceChip, paidPassCredits > 0 ? styles.balanceChipActive : styles.balanceChipMuted]}>
                        <Text style={styles.balanceChipLabel}>Paid</Text>
                        <Text style={styles.balanceChipValue}>{paidPassCredits}</Text>
                    </View>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {status === 'closed' ? (
                    <View style={styles.closedState}>
                        <View pointerEvents="none" style={styles.nightBackdrop}>
                            <View style={styles.moonAura} />
                            <Animated.View entering={FadeIn.duration(900).delay(80)} style={[styles.star, styles.starOne]} />
                            <Animated.View entering={FadeIn.duration(1100).delay(180)} style={[styles.star, styles.starTwo]} />
                            <Animated.View entering={FadeIn.duration(1300).delay(300)} style={[styles.star, styles.starThree]} />
                            <Animated.View entering={FadeIn.duration(950).delay(420)} style={[styles.star, styles.starFour]} />
                            <Animated.View entering={FadeIn.duration(1200).delay(560)} style={[styles.star, styles.starFive]} />
                            <Animated.View entering={FadeIn.duration(1000).delay(700)} style={[styles.star, styles.starSix]} />
                        </View>
                        <View style={styles.moonShell}>
                            <Ionicons name="moon" size={72} color={COLORS.primary} />
                        </View>
                        <Text style={styles.heroText}>Chat Night is Closed</Text>
                        <Text style={styles.closedSubText}>Next session starts at {nextSession}</Text>
                        <Text style={styles.descText}>
                            Every night at 8 PM, join the live voice chat pool to meet people instantly.
                        </Text>
                        {renderEntryStatusCard()}
                    </View>
                ) : status === 'searching' ? (
                    <Animated.View style={[styles.searchingState, animatedSearchStyle]}>
                        <ActivityIndicator size={60} color={COLORS.primary} />
                        <Text style={styles.heroText}>Finding a Match...</Text>
                        <Text style={styles.descText}>Please wait while we connect you with someone.</Text>
                        <TouchableOpacity style={styles.cancelButton} onPress={cancelSearch}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : status === 'gated' ? (
                    <View style={styles.closedState}>
                        <Ionicons name="lock-closed" size={80} color={COLORS.secondaryText} />
                        <Text style={styles.heroText}>Unlock Chat Night</Text>

                        <Card style={styles.gatedCard}>
                            <Text style={styles.gatedTitle}>Profile Completion Required</Text>
                            <Text style={styles.gatedDesc}>
                                Your profile must be complete to join Chat Night.
                                {profileIssue ? ` ${profileIssue.message}` : ''}
                            </Text>

                            <Text style={styles.gatedPasses}>
                                {freePassesRemaining} free today | {paidPassCredits} paid credits
                            </Text>

                            <TouchableOpacity
                                style={styles.fixButton}
                                onPress={() => router.push('/(tabs)/profile')}
                            >
                                <Text style={styles.fixButtonText}>Complete Profile</Text>
                                <Ionicons name="arrow-forward" size={16} color="#FFF" style={styles.fixButtonIcon} />
                            </TouchableOpacity>
                        </Card>

                        {renderEntryStatusCard()}
                    </View>
                ) : (
                    <View style={styles.openState}>
                        <Ionicons name="sparkles" size={80} color={COLORS.primary} />
                        <Text style={styles.heroText}>{"It's Chat Night!"}</Text>
                        <Text style={styles.subText}>
                            {entryBalanceState === 'paid_fallback'
                                ? 'Paid credits are ready'
                                : entryBalanceState === 'fully_exhausted'
                                    ? 'No passes available right now'
                                    : 'The pool is open.'}
                        </Text>
                        <Text style={styles.descText}>
                            {canEnterPool
                                ? 'You have 5 minutes to talk. No photos, no names. Just vibes.'
                                : 'The pool is open, but you need another Chat Night pass before you can join tonight.'}
                        </Text>

                        {renderEntryStatusCard()}

                        {canEnterPool ? (
                            <Animated.View style={[styles.enterActionWrap, animatedButtonStyle]}>
                                <TouchableOpacity
                                    style={[styles.enterButton, enteringPool && styles.enterButtonDisabled]}
                                    onPress={handleEnterPool}
                                    disabled={enteringPool}
                                >
                                    {enteringPool ? (
                                        <View style={styles.enteringRow}>
                                            <ActivityIndicator color={COLORS.primaryText} size="small" style={styles.enteringSpinner} />
                                            <Text style={styles.enterText}>Finding someone...</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.enterText}>Enter Pool</Text>
                                    )}
                                </TouchableOpacity>
                            </Animated.View>
                        ) : null}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: SPACING.screen,
        alignItems: 'center',
        gap: SPACING.md,
    },
    headerTitle: {
        ...TYPOGRAPHY.h1,
        color: COLORS.primaryText,
    },
    apiText: {
        fontSize: 10,
        color: COLORS.disabledText,
    },
    balanceGroup: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    balanceChip: {
        minWidth: 70,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
    },
    balanceChipActive: {
        backgroundColor: 'rgba(255,107,157,0.15)',
        borderColor: COLORS.primary,
    },
    balanceChipMuted: {
        backgroundColor: 'rgba(168,155,194,0.08)',
        borderColor: COLORS.border,
    },
    balanceChipLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.secondaryText,
        textAlign: 'center',
    },
    balanceChipValue: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        textAlign: 'center',
        fontSize: 18,
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.section,
        paddingBottom: SPACING.section,
    },
    closedState: {
        alignItems: 'center',
        position: 'relative',
        width: '100%',
        maxWidth: 480,
        overflow: 'visible',
    },
    nightBackdrop: {
        position: 'absolute',
        width: 320,
        height: 320,
        alignItems: 'center',
        justifyContent: 'center',
        top: -120,
    },
    moonAura: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 999,
        backgroundColor: 'rgba(255,107,157,0.08)',
    },
    moonShell: {
        borderRadius: RADIUS.round,
        padding: SPACING.md,
        backgroundColor: 'rgba(255,107,157,0.08)',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 10,
    },
    star: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: RADIUS.round,
        backgroundColor: '#F5F0FF',
        shadowColor: '#F5F0FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 6,
    },
    starOne: { top: 60, left: 36, opacity: 0.7 },
    starTwo: { top: 30, right: 44, opacity: 0.9 },
    starThree: { top: 110, right: 12, opacity: 0.6 },
    starFour: { top: 150, left: 22, opacity: 0.8 },
    starFive: { top: 84, left: 150, opacity: 0.6 },
    starSix: { top: 42, left: 212, opacity: 0.75 },
    searchingState: {
        width: '100%',
        maxWidth: 480,
        alignItems: 'center',
    },
    openState: {
        width: '100%',
        maxWidth: 480,
        alignItems: 'center',
    },
    heroText: {
        ...TYPOGRAPHY.display,
        marginVertical: SPACING.lg,
        textAlign: 'center',
        color: COLORS.primaryText,
    },
    subText: {
        ...TYPOGRAPHY.h2,
        color: COLORS.secondaryText,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    closedSubText: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primary,
        fontWeight: '600',
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    descText: {
        ...TYPOGRAPHY.bodyBase,
        textAlign: 'center',
        color: COLORS.secondaryText,
        marginBottom: SPACING.xl,
        lineHeight: 24,
    },
    entryStateCard: {
        width: '100%',
        borderWidth: 1,
    },
    entryStateCardFree: {
        borderColor: 'rgba(16,185,129,0.35)',
        backgroundColor: 'rgba(16,185,129,0.08)',
    },
    entryStateCardPaid: {
        borderColor: 'rgba(255,107,157,0.35)',
        backgroundColor: 'rgba(255,107,157,0.08)',
    },
    entryStateCardExhausted: {
        borderColor: 'rgba(225,29,72,0.35)',
        backgroundColor: 'rgba(225,29,72,0.08)',
    },
    entryStateHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    entryStateIconWrap: {
        width: 42,
        height: 42,
        borderRadius: RADIUS.round,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    entryStateIconFree: {
        backgroundColor: 'rgba(16,185,129,0.14)',
    },
    entryStateIconPaid: {
        backgroundColor: 'rgba(255,107,157,0.14)',
    },
    entryStateIconExhausted: {
        backgroundColor: 'rgba(225,29,72,0.14)',
    },
    entryStateCopy: {
        flex: 1,
    },
    entryStateTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        fontSize: 18,
        marginBottom: SPACING.xs,
    },
    entryStateBody: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.primaryText,
    },
    entryStateButton: {
        marginTop: SPACING.lg,
    },
    enterActionWrap: {
        marginTop: SPACING.xl,
    },
    enterButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.display,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.pill,
        ...SHADOWS.card,
    },
    enterButtonDisabled: {
        backgroundColor: COLORS.disabled,
        shadowOpacity: 0,
        elevation: 0,
    },
    enteringRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    enteringSpinner: {
        marginRight: 10,
    },
    enterText: {
        ...TYPOGRAPHY.bodyLarge,
        fontWeight: 'bold',
        color: COLORS.primaryText,
    },
    cancelButton: {
        marginTop: SPACING.xl,
    },
    cancelText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
    },
    gatedCard: {
        alignItems: 'center',
        marginTop: SPACING.lg,
        marginBottom: SPACING.lg,
        width: '100%',
        backgroundColor: COLORS.surface,
        borderColor: COLORS.border,
        borderWidth: 1,
        borderRadius: RADIUS.lg,
    },
    gatedTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.sm,
    },
    gatedDesc: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        textAlign: 'center',
        marginBottom: SPACING.md,
    },
    gatedPasses: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        fontWeight: '600',
        marginBottom: SPACING.lg,
    },
    fixButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: RADIUS.pill,
    },
    fixButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    fixButtonIcon: {
        marginLeft: 8,
    },
});
