import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/Theme';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing
} from 'react-native-reanimated';

import { API_BASE_URL } from '../../constants/Api';

export default function ChatNightScreen() {
    const router = useRouter();
    const { token } = useAuth();

    // UI States: 'loading' | 'closed' | 'open' | 'searching' | 'gated'
    const [status, setStatus] = useState<'loading' | 'closed' | 'open' | 'searching' | 'gated'>('loading');
    const [passes, setPasses] = useState(0);
    const [nextSession, setNextSession] = useState("20:00");
    const [profileIssue, setProfileIssue] = useState<any>(null);
    const [pollId, setPollId] = useState<any>(null);
    const [enteringPool, setEnteringPool] = useState(false);

    const appState = useRef(AppState.currentState);

    // Animations
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    // Breathing Animation for Enter Button
    useEffect(() => {
        if (status === 'open' && !enteringPool) {
            scale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        } else {
            scale.value = withTiming(1);
        }
    }, [status, enteringPool]);

    // Pulse Animation for Searching
    useEffect(() => {
        if (status === 'searching') {
            opacity.value = withRepeat(
                withSequence(
                    withTiming(0.6, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1,
                true
            );
        } else {
            opacity.value = withTiming(1);
        }
    }, [status]);

    const animatedButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }]
    }));

    const animatedSearchStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    // Track AppState to pause/resume polling
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            appState.current = nextAppState;
        });
        return () => subscription.remove();
    }, []);

    // Initial Status Check & Polling for Open
    useEffect(() => {
        if (!token) return;

        checkStatus();

        // Poll status every 5 seconds if we are waiting for it to open
        const statusInterval = setInterval(() => {
            if (appState.current.match(/inactive|background/)) {
                return; // Skip polling if hidden
            }

            if (status === 'closed') {
                checkStatus();
            }
        }, 5000);

        return () => {
            clearInterval(statusInterval);
            stopPolling();
        };
    }, [status, token]); // Re-run if status changes or token becomes available

    const stopPolling = () => {
        if (pollId) {
            clearInterval(pollId);
            setPollId(null);
        }
    };

    const checkStatus = async () => {
        if (!token) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/chat-night/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 400) {
                const errData = await res.json();
                console.log("[ChatNight] 400 Gated:", errData);
                if (errData.detail && typeof errData.detail === 'string' && errData.detail.toLowerCase().includes('completion')) {
                    // Try to extract completion data if available in error structure (mocking logic here as backend might just send string)
                    // If backend sends structured error, use it. For now, assume we might need to fetch profile strength separately or rely on error text.
                    // Ideally backend 400 for status should return details. 
                    // Let's assume errData might have 'current_completion' if updated, otherwise we default.

                    setProfileIssue({
                        message: errData.detail,
                        needed: "Required Level",
                        current: "Your Level",
                        missing: [] // We might not get fields here unless endpoint updated
                    });
                    setStatus('gated');
                    return;
                }
            }

            const data = await res.json();

            // Handle success
            const remaining = data.passes_remaining_today !== undefined ? data.passes_remaining_today :
                (data.passes_remaining !== undefined ? data.passes_remaining : 0);
            setPasses(remaining);

            // Check for explicit status 'gated' (Day 7-A requirement)
            if (data.status === 'gated') {
                setProfileIssue({
                    message: data.detail || data.message || "Profile completion required.",
                    needed: "Required Level",
                    current: "Your Level",
                    missing: data.missing_fields || []
                });
                setStatus('gated');
                return;
            }

            if (data.is_open) {
                if (status !== 'searching' && status !== 'open') {
                    setStatus('open');
                }
            } else {
                setStatus('closed');
                setNextSession(data.next_start || "20:00");
            }
        } catch (e) {
            console.warn("[ChatNight] Status Check Failed", e);
            if (status !== 'closed' && status !== 'gated') setStatus('closed');
        }
    };

    const handleEnterPool = async () => {
        if (passes <= 0) {
            Alert.alert("No Passes", "You have used your pass for tonight. See you tomorrow!");
            return;
        }
        if (enteringPool) return; // Guard double-click

        setEnteringPool(true);
        setStatus('searching');

        try {
            // 1. Enter Pool
            const res = await fetch(`${API_BASE_URL}/api/chat-night/enter`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            console.log("[ChatNight] Enter response:", data);

            if (data.status === 'match_found') {
                console.log("[ChatNight] Match found immediately -> roomId:", data.room_id);
                stopPolling();
                router.replace({
                    pathname: '/chat/talk-room',
                    params: { roomId: data.room_id }
                });
                setStatus('open');
                setEnteringPool(false);
            } else if (data.status === 'queued') {
                console.log('[ChatNight] queued -> polling my-room');
                setEnteringPool(false);
                startPolling();
            } else {
                // Handle other statuses (e.g. active_room found directly)
                if (data.room_id) {
                    console.log("[ChatNight] Rejoining active room -> roomId:", data.room_id);
                    stopPolling();
                    router.replace({
                        pathname: '/chat/talk-room',
                        params: { roomId: data.room_id }
                    });
                    setStatus('open');
                    setEnteringPool(false);
                } else {
                    setEnteringPool(false);
                }
            }

        } catch (e) {
            console.error("Enter error", e);
            Alert.alert("Error", "Failed to join pool. Please check your connection.");
            setStatus('open');
            setEnteringPool(false);
        }
    };

    const startPolling = () => {
        stopPolling(); // Safety

        const pid = setInterval(async () => {
            if (appState.current.match(/inactive|background/)) {
                return; // Skip polling if hidden
            }

            try {
                const res = await fetch(`${API_BASE_URL}/api/chat-night/my-room`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                // If we get a valid room state
                if (data.state === 'active' || data.state === 'engaged') {
                    console.log('[ChatNight] my-room found -> roomId=', data.room_id);
                    stopPolling();

                    // Navigate
                    router.replace({
                        pathname: '/chat/talk-room',
                        params: { roomId: data.room_id }
                    });
                    setStatus('open');
                }
            } catch (e) {
                console.warn("[ChatNight] Polling error", e);
            }
        }, 2000);

        setPollId(pid);
    };

    const cancelSearch = async () => {
        stopPolling();
        console.log('[ChatNight] Cancelling search');
        try {
            await fetch(`${API_BASE_URL}/api/chat-night/leave`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Leave error", e);
        }
        setStatus('open'); // Revert to open state
        setEnteringPool(false);
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
                    <Text style={{ fontSize: 10, color: COLORS.disabledText }}>API: {API_BASE_URL.replace('http://', '')}</Text>
                </View>
                <View style={styles.passContainer}>
                    <Ionicons name="ticket" size={20} color={COLORS.primary} />
                    <Text style={styles.passText}>{passes} Pass Left</Text>
                </View>
            </View>

            <View style={styles.content}>
                {status === 'closed' ? (
                    <View style={styles.closedState}>
                        <Ionicons name="moon" size={80} color={COLORS.secondaryText} />
                        <Text style={styles.heroText}>Chat Night is Closed</Text>
                        <Text style={styles.subText}>Next session starts at {nextSession}</Text>
                        <Text style={styles.descText}>
                            Every night at 8 PM, join the live voice chat pool to meet people instantly.
                        </Text>
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
                                You have {passes} passes for today
                            </Text>

                            <TouchableOpacity
                                style={styles.fixButton}
                                onPress={() => router.push('/(tabs)/profile')}
                            >
                                <Text style={styles.fixButtonText}>Complete Profile</Text>
                                <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </Card>
                    </View>
                ) : (
                    <View style={styles.openState}>
                        <Ionicons name="sparkles" size={80} color={COLORS.primary} />
                        <Text style={styles.heroText}>It's Chat Night!</Text>
                        <Text style={styles.subText}>The pool is open.</Text>
                        <Text style={styles.descText}>
                            You have 5 minutes to talk. No photos, no names. Just vibes.
                        </Text>

                        <Animated.View style={animatedButtonStyle}>
                            <TouchableOpacity
                                style={[styles.enterButton, enteringPool && styles.enterButtonDisabled]}
                                onPress={handleEnterPool}
                                disabled={enteringPool}
                            >
                                {enteringPool ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <ActivityIndicator color={COLORS.primaryText} size="small" style={{ marginRight: 10 }} />
                                        <Text style={styles.enterText}>Finding someone...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.enterText}>Enter Pool</Text>
                                )}
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', padding: SPACING.screen, alignItems: 'center'
    },
    headerTitle: {
        ...TYPOGRAPHY.h1,
        color: COLORS.primaryText
    },
    passContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: SPACING.sm, borderRadius: RADIUS.pill,
        borderWidth: 1, borderColor: COLORS.border // Optional polish
    },
    passText: {
        marginLeft: SPACING.xs,
        fontWeight: 'bold',
        color: COLORS.primaryText,
        fontSize: 14
    },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.section },
    closedState: { alignItems: 'center' },
    searchingState: { alignItems: 'center' },
    openState: { alignItems: 'center' },
    heroText: {
        ...TYPOGRAPHY.display,
        marginVertical: SPACING.lg,
        textAlign: 'center',
        color: COLORS.primaryText
    },
    subText: {
        ...TYPOGRAPHY.h2,
        color: COLORS.secondaryText,
        marginBottom: SPACING.sm
    },
    descText: {
        ...TYPOGRAPHY.bodyBase,
        textAlign: 'center',
        color: COLORS.secondaryText,
        marginBottom: SPACING.display,
        lineHeight: 24
    },
    enterButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: SPACING.display,
        paddingVertical: SPACING.md,
        borderRadius: RADIUS.pill,
        ...SHADOWS.card
    },
    enterButtonDisabled: {
        backgroundColor: COLORS.disabled,
        shadowOpacity: 0,
        elevation: 0
    },
    enterText: {
        ...TYPOGRAPHY.bodyLarge,
        fontWeight: 'bold',
        color: COLORS.primaryText
    },
    cancelButton: { marginTop: SPACING.xl },
    cancelText: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText
    },

    // Gated Styles
    gatedCard: {
        alignItems: 'center',
        marginTop: SPACING.lg,
        width: '90%'
    },
    gatedTitle: {
        ...TYPOGRAPHY.h2,
        color: COLORS.primaryText,
        marginBottom: SPACING.sm
    },
    gatedDesc: {
        ...TYPOGRAPHY.bodyBase,
        color: COLORS.secondaryText,
        textAlign: 'center',
        marginBottom: SPACING.md
    },
    gatedPasses: {
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: '600',
        marginBottom: SPACING.lg
    },
    fixButton: {
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: RADIUS.pill
    },
    fixButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16
    }
});
